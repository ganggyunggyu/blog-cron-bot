import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * 비밀번호를 scrypt로 해싱한다.
 *
 * bcrypt/argon2를 새로 받지 않고 Node 내장 crypto만 쓴다. 저장 형식에 파라미터를
 * 같이 넣어, 나중에 비용을 올려도 예전 해시를 그대로 검증할 수 있게 한다.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${KEY_LENGTH}$${salt}$${derived.toString('hex')}`;
};

/** 저장된 해시와 입력 비밀번호를 상수 시간으로 비교한다. */
export const verifyPassword = async (
  password: string,
  storedHash: string
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
