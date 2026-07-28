const RAILWAY_VCPU_PER_MINUTE_USD = 0.000463;
const RAILWAY_MEMORY_GB_PER_MINUTE_USD = 0.000231;
const MINUTES_PER_30_DAY_MONTH = 43_200;

export interface RailwayCostEstimate {
  runUsd: number;
  monthlyUsd: number;
  runKrw: number;
  monthlyKrw: number;
  vcpu: number;
  memoryGb: number;
  workerCount: number;
}

const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const estimateRailwayWorkerCost = (
  workerCount: number,
  durationMs: number,
  environment = process.env
): RailwayCostEstimate => {
  const vcpu = positiveNumber(environment.RAILWAY_COST_ESTIMATE_VCPU, 1);
  const memoryGb = positiveNumber(
    environment.RAILWAY_COST_ESTIMATE_MEMORY_GB,
    1
  );
  const krwPerUsd = positiveNumber(
    environment.RAILWAY_COST_ESTIMATE_KRW_PER_USD,
    1_400
  );
  const minuteRate =
    vcpu * RAILWAY_VCPU_PER_MINUTE_USD +
    memoryGb * RAILWAY_MEMORY_GB_PER_MINUTE_USD;
  const safeWorkerCount = Math.max(0, workerCount);
  const runUsd = safeWorkerCount * (durationMs / 60_000) * minuteRate;
  const monthlyUsd = safeWorkerCount * MINUTES_PER_30_DAY_MONTH * minuteRate;

  return {
    runUsd,
    monthlyUsd,
    runKrw: runUsd * krwPerUsd,
    monthlyKrw: monthlyUsd * krwPerUsd,
    vcpu,
    memoryGb,
    workerCount: safeWorkerCount,
  };
};

export const formatRailwayCost = (usd: number, krw: number): string =>
  `$${usd.toFixed(3)} (약 ${Math.round(krw).toLocaleString('ko-KR')}원)`;
