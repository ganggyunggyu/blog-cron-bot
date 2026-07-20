import assert from 'node:assert/strict';
import test from 'node:test';
import { usesSuiteRunLock } from './job-resource-manager';
import { getJobDefinition } from './job-registry';

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

test('독립 노출체크는 대시보드 파일 잠금을 유지함', () => {
  assert.equal(usesSuiteRunLock(requireJob('root-more-exposure')), false);
});
