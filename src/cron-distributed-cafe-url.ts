import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { connectDB, disconnectDB, getAllRootKeywords } from './database';
import { resolveOutputFilePath } from './lib/csv-output/output-path';
import { logger } from './lib/logger';
import { emitExposureProgress } from './lib/exposure-progress';
import {
  ROOT_CAFE_URL_TARGET,
} from './lib/distributed-exposure/adhoc-targets';
import { buildKeywordTargetJobs } from './lib/distributed-exposure/job-planner';
import {
  assertNoActiveDistributedRun,
  createDistributedRun,
  finishDistributedRun,
} from './lib/distributed-exposure/run-store';
import { waitForDistributedRun } from './lib/distributed-exposure/run-monitor';
import { getDistributedRunSnapshot } from './lib/distributed-exposure/queue';
import {
  CAFE_URL_FAILURE_MESSAGES,
  parseNaverCafeUrl,
} from './lib/naver-cafe-url';
import type { RootCafeUrlRow } from './lib/root-cafe-url-check';
import { ROOT_CAFE_URL_PROGRESS_TARGET } from './lib/root-cafe-url-check';
import {
  clearRootCafeUrlResults,
  getRootCafeUrlResults,
} from './lib/root-cafe-url-check/store';
import { syncRootKeywordsFromSheet } from './lib/root-keyword-sync';
import { getKSTTimestamp } from './utils';

dotenv.config();

const DEFAULT_TIMEOUT_MINUTES = 30;
const localWorkers = new Set<ChildProcess>();

const rawUrl =
  process.argv.find((value) => value.startsWith('--url='))?.slice(6) ?? '';

const stopWorkers = (): void => {
  localWorkers.forEach((worker) => {
    if (!worker.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-worker.pid, 'SIGTERM');
      else worker.kill('SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  });
};

process.once('SIGINT', stopWorkers);
process.once('SIGTERM', stopWorkers);

const startLocalWorker = (runId: string): void => {
  if (process.env.DISTRIBUTED_EXPOSURE_LOCAL_WORKER === 'false') return;
  const environment = { ...process.env };
  delete environment.PORT;
  const worker = spawn(
    'pnpm',
    ['run', 'exposure:worker', '--', `--run-id=${runId}`],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    }
  );
  localWorkers.add(worker);
  worker.once('close', () => localWorkers.delete(worker));
};

const getTimeoutMs = (): number => {
  const minutes = Number(process.env.DISTRIBUTED_EXPOSURE_TIMEOUT_MINUTES);
  return (
    (Number.isFinite(minutes) && minutes >= 5
      ? minutes
      : DEFAULT_TIMEOUT_MINUTES) * 60_000
  );
};

const countBy = (
  rows: readonly RootCafeUrlRow[],
  status: RootCafeUrlRow['status']
): RootCafeUrlRow[] => rows.filter((row) => row.status === status);

const main = async (): Promise<void> => {
  const parsed = parseNaverCafeUrl(rawUrl);
  if (!parsed.ok) throw new Error(CAFE_URL_FAILURE_MESSAGES[parsed.reason]);
  const url = rawUrl.trim();

  const mongoUri = String(process.env.MONGODB_URI ?? '').trim();
  if (!mongoUri) throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');

  const runId = randomUUID();
  await connectDB(mongoUri);

  try {
    await assertNoActiveDistributedRun();

    // 시트 동기화는 여기서 한 번만 한다. 조각이 각자 하면 서로의 키워드를 지운다.
    const syncResult = await syncRootKeywordsFromSheet();
    logger.success(
      `루트 시트 동기화 완료 (삭제 ${syncResult.deleted}, 삽입 ${syncResult.inserted})`
    );

    const rootKeywords = await getAllRootKeywords();
    if (rootKeywords.length === 0) throw new Error('루트 키워드가 하나도 없음');

    // 샤딩은 검색어가 같은 키워드를 한 조각에 모은다. "청주맛집(A)"와 "청주맛집(B)"는
    // 크롤러가 괄호를 떼면 같은 검색이라, 조각 안에서 중복이 자연히 정리된다.
    const jobs = buildKeywordTargetJobs(
      ROOT_CAFE_URL_TARGET,
      rootKeywords.map(({ _id, keyword }) => ({ _id, keyword }))
    ).map((job) => ({ ...job, jobKind: 'root-cafe-url' as const, cafeUrl: url }));

    // 앞선 실행이 남긴 행이 섞이면 안 된다.
    await clearRootCafeUrlResults(runId);
    await createDistributedRun({
      runId,
      targets: [ROOT_CAFE_URL_TARGET],
      concurrency: 0,
      maxPages: 1,
      jobs,
    });

    emitExposureProgress(ROOT_CAFE_URL_PROGRESS_TARGET, 0, jobs.length, 'pending');
    logger.summary.start('카페 URL 다중 워커 노출체크', [
      { label: '실행 ID', value: runId },
      { label: '카페', value: parsed.cafeId },
      { label: '글 번호', value: parsed.articleId || '(카페 전체)' },
      { label: '루트 키워드', value: `${rootKeywords.length}개` },
      { label: '분산 작업', value: `${jobs.length}개 조각` },
    ]);

    startLocalWorker(runId);
    const outcome = await waitForDistributedRun(runId, getTimeoutMs(), () => false);
    const snapshot = await getDistributedRunSnapshot(runId);

    const rows = await getRootCafeUrlResults(runId);
    const exposed = countBy(rows, '노출');
    const otherArticle = countBy(rows, '같은 카페 다른 글');
    const failed = countBy(rows, '확인실패');

    const outputPath = resolveOutputFilePath(
      `root_cafe_url_${getKSTTimestamp()}.json`
    );
    fs.writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          summary: {
            runId,
            url,
            cafeId: parsed.cafeId,
            articleId: parsed.articleId,
            // 계획한 키워드 수를 쓴다. 돌아온 행만 세면 절반이 유실돼도 100%로 보인다.
            plannedKeywords: rootKeywords.length,
            checkedKeywords: rows.length,
            exposedCount: exposed.length,
            otherArticleCount: otherArticle.length,
            failedCount: failed.length,
          },
          rows,
        },
        null,
        2
      )}\n`
    );

    emitExposureProgress(
      ROOT_CAFE_URL_PROGRESS_TARGET,
      snapshot?.success ?? 0,
      jobs.length,
      outcome.unfinishedTargets.length > 0 ? 'failed' : 'success'
    );

    if (outcome.unfinishedTargets.length > 0) {
      await finishDistributedRun(runId, 'failed', outcome.failureDetail);
      throw new Error(
        `조각을 다 끝내지 못함: ${outcome.failureDetail || '알 수 없음'} ` +
          `(여기까지 결과: ${outputPath})`
      );
    }

    // 조각이 전부 성공했는데 돌아온 행이 계획보다 적으면, 결과가 유실된 것이다.
    // 이걸 막지 않으면 "노출 0개"가 "확인한 게 없음"과 구분되지 않는다.
    if (rows.length < rootKeywords.length) {
      await finishDistributedRun(runId, 'failed', '결과 유실');
      throw new Error(
        `조각은 다 끝났는데 결과가 ${rootKeywords.length}개 중 ${rows.length}개만 돌아옴. ` +
          `결과 저장 경로를 확인해야 함 (${outputPath})`
      );
    }

    await finishDistributedRun(runId, 'success');

    logger.summary.complete('루트 · 카페 URL 노출체크 완료', [
      { label: '카페', value: parsed.cafeId },
      { label: '글 번호', value: parsed.articleId || '(카페 전체)' },
      { label: '전체 키워드', value: `${rootKeywords.length}개` },
      { label: '확인한 키워드', value: `${rows.length}개` },
      { label: '노출', value: `${exposed.length}개` },
      { label: '같은 카페 다른 글', value: `${otherArticle.length}개` },
      { label: '확인실패', value: `${failed.length}개` },
    ]);
    if (exposed.length > 0) {
      logger.info(
        `노출 키워드: ${exposed
          .map(({ keyword, rank }) => `${keyword}(${rank}위)`)
          .join(', ')}`
      );
    }
    logger.success(`결과 저장: ${outputPath}`);
  } catch (error) {
    await finishDistributedRun(
      runId,
      'failed',
      error instanceof Error ? error.message : String(error)
    ).catch(() => undefined);
    throw error;
  } finally {
    stopWorkers();
    await disconnectDB();
  }
};

main().catch((error) => {
  logger.error(`카페 URL 분산 노출체크 실패: ${(error as Error).message}`);
  process.exit(1);
});
