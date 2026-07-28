import mongoose from 'mongoose';
import {
  MANAGED_BLOG_ID_LIST_IDS,
  applyBlogIdOverrides,
  type BlogIdOverrides,
  type ManagedBlogIdListId,
} from '../../constants/blog-ids';
import { logger } from '../logger';

/**
 * 계정 덮어쓰기 저장소.
 *
 * 크롤 워커는 대시보드와 다른 Railway 서비스에서 돌고 Railway 볼륨은 서비스 간 공유가
 * 안 되므로, 파일이 아니라 MongoDB에 둔다. 파일로 두면 "대시보드에서 추가했는데 워커는
 * 옛 목록으로 크롤"하는 조용한 오판정이 생긴다.
 */
export const BLOG_ID_OVERRIDE_COLLECTION = 'blogIdOverrides';

export interface BlogIdOverrideDocument {
  _id: ManagedBlogIdListId;
  added: string[];
  removed: string[];
  updatedAt: Date;
}

const MAX_IDS_PER_LIST = 500;

/** 사용자가 블로그 URL을 붙여넣어도 받아주고, 최종적으로 소문자 ID만 남긴다. */
export const normalizeBlogId = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  const fromUrl = trimmed.match(
    /(?:m\.)?blog\.naver\.com\/([^/?&#\s]+)/
  )?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/[/?&#].*$/, '');
  return /^[a-z0-9_-]{2,40}$/.test(candidate) ? candidate : '';
};

export const normalizeBlogIdList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.map(normalizeBlogId).filter((id) => id.length > 0))
      ).slice(0, MAX_IDS_PER_LIST)
    : [];

const isManagedListId = (value: unknown): value is ManagedBlogIdListId =>
  typeof value === 'string' &&
  (MANAGED_BLOG_ID_LIST_IDS as readonly string[]).includes(value);

const getCollection = () => {
  const db = mongoose.connection?.db;
  if (!db) throw new Error('MongoDB 연결이 없음');
  return db.collection<BlogIdOverrideDocument>(BLOG_ID_OVERRIDE_COLLECTION);
};

export const loadBlogIdOverrides = async (): Promise<BlogIdOverrides> => {
  const documents = await getCollection().find({}).toArray();
  return documents.reduce<BlogIdOverrides>((overrides, document) => {
    if (!isManagedListId(document._id)) return overrides;
    return {
      ...overrides,
      [document._id]: {
        added: normalizeBlogIdList(document.added),
        removed: normalizeBlogIdList(document.removed),
      },
    };
  }, {});
};

/**
 * 저장된 덮어쓰기를 읽어 상수 목록에 적용한다. 노출체크 시작 직후 한 번만 부른다.
 * 읽기에 실패해도 크롤을 막지 않는다 — 코드 기본값으로 계속 진행하는 편이 안전하다.
 */
export const applyStoredBlogIdOverrides = async (): Promise<void> => {
  try {
    const overrides = await loadBlogIdOverrides();
    applyBlogIdOverrides(overrides);
    const summary = Object.entries(overrides)
      .map(
        ([listId, override]) =>
          `${listId}(+${override.added.length}/-${override.removed.length})`
      )
      .join(', ');
    if (summary) {
      logger.info(`[계정] 저장된 계정 덮어쓰기 적용: ${summary}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[계정] 계정 덮어쓰기 로드 실패, 코드 기본값 사용: ${message}`);
  }
};
