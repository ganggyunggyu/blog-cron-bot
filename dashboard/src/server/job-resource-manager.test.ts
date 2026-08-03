import assert from 'node:assert/strict';
import test from 'node:test';
import { usesSuiteRunLock } from './job-resource-manager';
import { getJobDefinition, type JobDefinition } from './job-registry';

const requireJob = (jobId: string) => {
  const job = getJobDefinition(jobId);
  assert.ok(job);
  return job;
};

test('suite와 suite 래퍼는 내부 실행 잠금을 사용함', () => {
  assert.equal(usesSuiteRunLock(requireJob('exposure-suite')), true);
  assert.equal(usesSuiteRunLock(requireJob('package-exposure')), true);
  assert.equal(usesSuiteRunLock(requireJob('pet-exposure')), true);
});

/**
 * 더보기는 두 종류 모두 분산 러너로 들어간다. 분산 러너는 assertNoActiveDistributedRun으로
 * 자기 실행 잠금을 따로 걸므로 대시보드 파일 잠금까지 잡으면 안 된다.
 * 루트 더보기가 단일 프로세스에서 분산으로 옮겨오면서 이쪽으로 넘어왔다.
 */
test('더보기는 분산 러너 잠금을 사용함', () => {
  const rootMore = requireJob('root-more-exposure');
  assert.equal(rootMore.script, 'exposure:distributed:more');
  assert.deepEqual(rootMore.args, ['--targets=root']);
  assert.equal(usesSuiteRunLock(rootMore), true);
  assert.equal(
    usesSuiteRunLock(requireJob('package-general-dogmaru-more-exposure')),
    true,
  );
});

test('분산 러너를 안 타는 잡은 대시보드 파일 잠금을 유지함', () => {
  const localJob: JobDefinition = {
    id: 'local-only',
    label: '로컬 전용',
    script: 'cron:root',
    description: '분산 실행이 꺼져 있을 때 쓰는 로컬 경로',
    kind: 'standard',
    resourceGroup: 'exposure',
  };
  assert.equal(usesSuiteRunLock(localJob), false);
});
