import type { ExposureTargetId } from '../exposure-suite/options';

/**
 * 분산 계층에서만 쓰는 대상.
 *
 * ExposureTargetId(7개)를 넓히지 않는 이유가 두 가지다.
 * 1) parseTargets는 --targets가 없으면 전체 id를 펼친다. union을 넓히면
 *    `pnpm exposure:distributed`를 인자 없이 돌릴 때 URL도 없는 카페 URL 체크가
 *    끼어들어 기본 실행이 깨진다.
 * 2) 화면의 "대상과 페이지 범위 고르기" 체크박스도 그 목록에서 나온다.
 *
 * 그리고 별도 문자열이라 worker-child의 resolveTargetCommand까지 흘러가면 거기서
 * 예외로 떨어진다. jobKind 분기를 빠뜨렸을 때 조용히 cron:root로 폴스루해서
 * 진짜 루트 결과를 덮어쓰는 사고를 타입이 아니라 구조가 막는다.
 */
export const ADHOC_TARGET_IDS = ['root-cafe-url'] as const;

export type AdhocTargetId = (typeof ADHOC_TARGET_IDS)[number];

/** 잡 문서의 target에 들어갈 수 있는 값 전체. */
export type DistributedTargetId = ExposureTargetId | AdhocTargetId;

export const isAdhocTarget = (
  target: DistributedTargetId
): target is AdhocTargetId =>
  (ADHOC_TARGET_IDS as readonly string[]).includes(target);

export const ROOT_CAFE_URL_TARGET: AdhocTargetId = 'root-cafe-url';
