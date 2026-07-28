import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import mongoose from 'mongoose';

const scryptAsync = promisify(scrypt);

/**
 * 회원 인증.
 *
 * 저장 형식은 봇 쪽 src/lib/tenant(members 컬렉션, scrypt 해시)와 동일해야 한다.
 * 대시보드가 봇 소스를 직접 import 하지 않으므로 같은 규칙을 여기에 맞춰 둔다.
 */
const MEMBER_COLLECTION = 'members';

export interface MemberAccount {
  id: string;
  loginId: string;
  displayName: string;
}

interface MemberDocument {
  _id: string;
  loginId: string;
  passwordHash: string;
  displayName?: string;
}

const verifyScryptHash = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const [scheme, keyLengthRaw, salt, hash] = String(storedHash ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const keyLength = Number(keyLengthRaw);
  if (!Number.isInteger(keyLength) || keyLength < 1) return false;

  const expected = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, keyLength)) as Buffer;
  if (derived.length !== expected.length) return false;

  return timingSafeEqual(derived, expected);
};

const connect = async () => {
  const uri = String(process.env.MONGODB_URI ?? '').trim();
  if (!uri) throw new Error('MONGODB_URI 환경변수가 설정되지 않음');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB 연결이 없음');
  return db.collection<MemberDocument>(MEMBER_COLLECTION);
};

export const authenticateMemberAccount = async (
  loginId: string,
  password: string,
): Promise<MemberAccount | null> => {
  const collection = await connect();
  const document = await collection.findOne({
    loginId: loginId.trim().toLowerCase(),
  });
  if (!document) return null;

  const isValid = await verifyScryptHash(password, document.passwordHash);
  if (!isValid) return null;

  return {
    id: document._id,
    loginId: document.loginId,
    displayName: document.displayName ?? document.loginId,
  };
};
