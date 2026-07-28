import mongoose from 'mongoose';
import { hashPassword, verifyPassword } from './password';
import { EMPTY_PRESET, LAB_21_PRESET, type TenantPreset } from './preset';

/**
 * 회원과 프리셋 저장소.
 *
 * 크롤 워커는 대시보드와 다른 Railway 서비스라 볼륨을 공유하지 않는다.
 * 회원 설정을 워커까지 전달할 수 있는 통로는 MongoDB뿐이다.
 */
export const MEMBER_COLLECTION = 'members';

export interface MemberDocument {
  _id: string;
  loginId: string;
  passwordHash: string;
  displayName: string;
  preset: TenantPreset;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberSummary {
  id: string;
  loginId: string;
  displayName: string;
  preset: TenantPreset;
}

const getCollection = () => {
  const db = mongoose.connection?.db;
  if (!db) throw new Error('MongoDB 연결이 없음');
  return db.collection<MemberDocument>(MEMBER_COLLECTION);
};

const toSummary = (document: MemberDocument): MemberSummary => ({
  id: document._id,
  loginId: document.loginId,
  displayName: document.displayName,
  preset: document.preset ?? EMPTY_PRESET,
});

export const normalizeLoginId = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .toLowerCase();

export const findMemberByLoginId = async (
  loginId: string
): Promise<MemberSummary | null> => {
  const document = await getCollection().findOne({
    loginId: normalizeLoginId(loginId),
  });
  return document ? toSummary(document) : null;
};

export const findMemberById = async (
  id: string
): Promise<MemberSummary | null> => {
  const document = await getCollection().findOne({ _id: id });
  return document ? toSummary(document) : null;
};

/** 로그인 성공 시 회원 정보를 돌려주고, 실패하면 null을 준다. */
export const authenticateMember = async (
  loginId: string,
  password: string
): Promise<MemberSummary | null> => {
  const document = await getCollection().findOne({
    loginId: normalizeLoginId(loginId),
  });
  if (!document) return null;

  const isValid = await verifyPassword(password, document.passwordHash);
  return isValid ? toSummary(document) : null;
};

export interface CreateMemberInput {
  loginId: string;
  password: string;
  displayName?: string;
  preset?: TenantPreset;
}

export const createMember = async ({
  loginId,
  password,
  displayName,
  preset,
}: CreateMemberInput): Promise<MemberSummary> => {
  const normalized = normalizeLoginId(loginId);
  if (normalized.length < 2) throw new Error('아이디는 2자 이상이어야 함');
  if (String(password ?? '').length < 6) {
    throw new Error('비밀번호는 6자 이상이어야 함');
  }

  const collection = getCollection();
  const existing = await collection.findOne({ loginId: normalized });
  if (existing) throw new Error('이미 사용 중인 아이디임');

  const now = new Date();
  const document: MemberDocument = {
    _id: normalized,
    loginId: normalized,
    passwordHash: await hashPassword(password),
    displayName: displayName?.trim() || normalized,
    // 새 회원은 빈 프리셋에서 시작한다. 남의 시트가 기본값으로 딸려가면 안 된다.
    preset: preset ?? EMPTY_PRESET,
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(document);
  return toSummary(document);
};

export const updateMemberPreset = async (
  memberId: string,
  preset: TenantPreset
): Promise<MemberSummary | null> => {
  const collection = getCollection();
  await collection.updateOne(
    { _id: memberId },
    { $set: { preset, updatedAt: new Date() } }
  );
  return findMemberById(memberId);
};

/**
 * 21lab 계정을 만들고 현재 운영 설정을 프리셋으로 넣는다. 이미 있으면 프리셋만 맞춘다.
 * 여러 번 실행해도 결과가 같도록 멱등하게 처리한다.
 */
export const seedLab21Member = async (
  password: string
): Promise<MemberSummary> => {
  const existing = await findMemberByLoginId('21lab');
  if (existing) {
    const updated = await updateMemberPreset(existing.id, LAB_21_PRESET);
    return updated ?? existing;
  }
  return createMember({
    loginId: '21lab',
    password,
    displayName: '21Lab',
    preset: LAB_21_PRESET,
  });
};
