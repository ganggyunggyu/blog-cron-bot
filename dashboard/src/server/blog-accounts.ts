import mongoose from 'mongoose';

/**
 * 노출체크 대상 계정 관리 저장소.
 *
 * 크롤 워커는 대시보드와 다른 Railway 서비스에서 돌고 볼륨이 공유되지 않으므로,
 * 봇(src/lib/blog-id-overrides)과 같은 MongoDB 컬렉션을 통해서만 값을 주고받는다.
 * 컬렉션 이름과 문서 모양이 봇 쪽과 반드시 같아야 한다.
 */
const COLLECTION = 'blogIdOverrides';
const MAX_IDS_PER_LIST = 500;

export const MANAGED_LISTS = [
  {
    id: 'suripet',
    label: '서리펫',
    description: '서리펫 노출체크 전용 계정',
    seed: ['hotelelena', 'pjwon03', 'ylk3516', 'inho5062'],
  },
  {
    id: 'dogmaru',
    label: '도그마루',
    description: '도그마루 노출체크 전용 계정',
    seed: [
      'tpeany',
      'nanugi99',
      'v3se',
      'mirca1004',
      'wandookong2',
      'yaboo_171022',
      'dudtjsdh159',
    ],
  },
] as const;

export type ManagedListId = (typeof MANAGED_LISTS)[number]['id'];

export interface BlogAccountList {
  id: ManagedListId;
  label: string;
  description: string;
  seed: string[];
  added: string[];
  removed: string[];
  effective: string[];
}

export const isManagedListId = (value: unknown): value is ManagedListId =>
  typeof value === 'string' &&
  MANAGED_LISTS.some((list) => list.id === value);

/** 블로그 URL을 붙여넣어도 받아주고 소문자 ID만 남긴다. 봇 쪽 정규화와 동일 규칙. */
export const normalizeBlogId = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  const fromUrl = trimmed.match(/(?:m\.)?blog\.naver\.com\/([^/?&#\s]+)/)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/[/?&#].*$/, '');
  return /^[a-z0-9_-]{2,40}$/.test(candidate) ? candidate : '';
};

const normalizeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.map(normalizeBlogId).filter((id) => id.length > 0))
      ).slice(0, MAX_IDS_PER_LIST)
    : [];

/** 시드 + 추가 − 제외. 봇의 resolveManagedBlogIds와 같은 규칙(제외 우선). */
export const resolveEffective = (
  seed: readonly string[],
  added: readonly string[],
  removed: readonly string[]
): string[] => {
  const removedSet = new Set(removed);
  return Array.from(new Set([...seed, ...added])).filter(
    (blogId) => !removedSet.has(blogId)
  );
};

/** 저장 문서. _id는 ObjectId가 아니라 목록 id 문자열이다(봇 쪽과 동일). */
interface BlogIdOverrideDocument {
  _id: ManagedListId;
  added?: string[];
  removed?: string[];
  updatedAt?: Date;
}

const connect = async () => {
  const uri = String(process.env.MONGODB_URI ?? '').trim();
  if (!uri) throw new Error('MONGODB_URI 환경변수가 설정되지 않음');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB 연결이 없음');
  return db.collection<BlogIdOverrideDocument>(COLLECTION);
};

export const getBlogAccountLists = async (): Promise<BlogAccountList[]> => {
  const collection = await connect();
  const documents = await collection.find({}).toArray();

  return MANAGED_LISTS.map((list) => {
    const document = documents.find((row) => row._id === list.id);
    const added = normalizeList(document?.added);
    const removed = normalizeList(document?.removed);
    return {
      id: list.id,
      label: list.label,
      description: list.description,
      seed: [...list.seed],
      added,
      removed,
      effective: resolveEffective(list.seed, added, removed),
    };
  });
};

export const addBlogAccount = async (
  listId: ManagedListId,
  rawBlogId: string
): Promise<BlogAccountList[]> => {
  const blogId = normalizeBlogId(rawBlogId);
  if (!blogId) throw new Error('블로그 ID 형식이 올바르지 않음');

  const collection = await connect();
  await collection.updateOne(
    { _id: listId },
    {
      $addToSet: { added: blogId },
      $pull: { removed: blogId },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
  return getBlogAccountLists();
};

export const removeBlogAccount = async (
  listId: ManagedListId,
  rawBlogId: string
): Promise<BlogAccountList[]> => {
  const blogId = normalizeBlogId(rawBlogId);
  if (!blogId) throw new Error('블로그 ID 형식이 올바르지 않음');

  const list = MANAGED_LISTS.find((entry) => entry.id === listId);
  const isSeed = list?.seed.includes(blogId as never) ?? false;
  const collection = await connect();

  // 코드 기본값(시드)은 지울 수 없으니 '제외' 목록에 넣고, 사용자가 추가한 건 그냥 뺀다.
  await collection.updateOne(
    { _id: listId },
    isSeed
      ? {
          $addToSet: { removed: blogId },
          $pull: { added: blogId },
          $set: { updatedAt: new Date() },
        }
      : { $pull: { added: blogId }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
  return getBlogAccountLists();
};
