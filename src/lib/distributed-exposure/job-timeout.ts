import type { ExposureTargetId } from '../exposure-suite/options';

const DEFAULT_JOB_TIMEOUT_MINUTES = 10;
/**
 * 페이지 대상(애견/서리펫/루트)은 키워드 수십~수백 개를 여러 페이지까지 훑는다.
 * 예전 값 2분은 한 번의 시도가 절대 끝날 수 없는 길이라, 매 시도가 중간에 잘리고
 * 몇 개씩만 갱신되다 재시도 예산(60회)을 통째로 태우고 최종 실패했다.
 * 한 시도가 실제로 완주할 수 있는 길이로 잡는다.
 */
const DEFAULT_PAGE_JOB_TIMEOUT_MINUTES = 15;

export const getDistributedJobTimeoutMs = (
  value = process.env.DISTRIBUTED_EXPOSURE_JOB_TIMEOUT_MINUTES,
  target?: ExposureTargetId
): number => {
  const minutes = Number(value);
  const defaultMinutes =
    target === 'root' || target === 'pet' || target === 'suripet'
      ? DEFAULT_PAGE_JOB_TIMEOUT_MINUTES
      : DEFAULT_JOB_TIMEOUT_MINUTES;
  const normalized =
    Number.isFinite(minutes) && minutes >= 1
      ? minutes
      : defaultMinutes;
  return normalized * 60_000;
};
