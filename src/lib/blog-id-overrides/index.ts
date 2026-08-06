import mongoose from 'mongoose';
import {
  MANAGED_BLOG_ID_LIST_IDS,
  applyBlogIdOverrides,
  applyResolvedBlogIdLists,
  type BlogIdOverrides,
  type ManagedBlogIdListId,
} from '../../constants/blog-ids';
import { connectDB, disconnectDB } from '../../database';
import { logger } from '../logger';
import { resolveTargetBlogIds, type TenantPreset } from '../tenant/preset';
import { findMemberByLoginId } from '../tenant/store';

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
 * 프리셋 대상 하나가 실제로 쓸 계정을 뽑는다. 그룹을 안 고른 대상은 건너뛴다.
 */
const resolvePresetList = (
  preset: TenantPreset,
  targetId: string
): string[] | undefined => {
  const target = preset.targets.find(({ id }) => id === targetId);
  if (!target) return undefined;
  const blogIds = resolveTargetBlogIds(preset, target);
  return blogIds.length > 0 ? blogIds : undefined;
};

/**
 * 설정 화면 프리셋을 계정 목록의 출처로 삼는다.
 *
 * 예전에는 관리 계정 목록(덮어쓰기 문서)과 프리셋이 따로 놀아서, 어디서 고쳐야 반영되는지가
 * 대상마다 달랐다. 프리셋에 그룹이 잡혀 있으면 그쪽을 쓰고, 아직 안 잡힌 계정만
 * 예전 덮어쓰기로 메운다.
 */
const applyPresetBlogIds = (preset: TenantPreset): string[] => {
  const base = resolvePresetList(preset, 'package') ??
    resolvePresetList(preset, 'general') ??
    resolvePresetList(preset, 'root');
  const dogmaru = resolvePresetList(preset, 'dogmaru');
  const suripet = resolvePresetList(preset, 'suripet');
  const pet = resolvePresetList(preset, 'pet');

  applyResolvedBlogIdLists({ base, dogmaru, suripet, pet });

  return [
    base ? `기본 ${base.length}` : '',
    dogmaru ? `도그마루 ${dogmaru.length}` : '',
    suripet ? `서리펫 ${suripet.length}` : '',
    pet ? `애견 ${pet.length}` : '',
  ].filter((entry) => entry.length > 0);
};

/**
 * 저장된 계정 설정을 읽어 상수 목록에 적용한다. 노출체크 시작 직후 한 번만 부른다.
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

  try {
    const loginId =
      String(process.env.EXPOSURE_TENANT_LOGIN_ID ?? '').trim() || '21lab';
    const member = await findMemberByLoginId(loginId);
    if (!member) {
      logger.warn(`[계정] ${loginId} 프리셋을 찾지 못해 코드 기본 계정 사용`);
      return;
    }
    const applied = applyPresetBlogIds(member.preset);
    if (applied.length > 0) {
      logger.info(`[계정] ${loginId} 프리셋 계정 적용: ${applied.join(', ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[계정] 프리셋 계정 로드 실패, 이전 목록 유지: ${message}`);
  }
};

/**
 * DB 연결이 열려 있지 않은 진입점을 위한 버전. 스스로 연결하고 끝나면 끊는다.
 *
 * 노출체크 중 일부(카페+블로그, 더보기)는 키워드를 시트에서만 읽고 원래 Mongo에
 * 연결하지 않는다. 그 상태로는 저장된 계정 설정을 읽을 방법이 없어 그동안 코드
 * 기본값만 쓰고 있었다 — 크롤은 정상으로 보여서 알아채기 어려운 종류의 누락이었다.
 * 실패해도 크롤은 코드 기본값으로 계속한다.
 */
export const applyStoredBlogIdOverridesStandalone = async (
  label: string
): Promise<void> => {
  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) return;
  const alreadyConnected = mongoose.connection.readyState !== 0;
  try {
    if (!alreadyConnected) await connectDB(mongoUri);
    await applyStoredBlogIdOverrides();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[계정] ${label} 계정 설정을 못 읽어 코드 기본값 사용: ${message}`);
  } finally {
    if (!alreadyConnected) await disconnectDB().catch(() => undefined);
  }
};
