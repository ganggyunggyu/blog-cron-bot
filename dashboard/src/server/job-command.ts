import { buildExposureSuiteArgs } from './exposure-suite-options';
import { InvalidJobInputError } from './job-errors';
import type { JobDefinition } from './job-registry';

const isEmptyOptionsObject = (input: unknown): boolean =>
  typeof input === 'object' &&
  input !== null &&
  !Array.isArray(input) &&
  Object.keys(input).length === 0;

export const buildJobSpawnArgs = (job: JobDefinition, input: unknown): string[] => {
  if (job.kind === 'exposure-suite') {
    const options = buildExposureSuiteArgs(input);
    return ['run', job.script, ...options];
  }

  if (input !== undefined && !isEmptyOptionsObject(input)) {
    throw new InvalidJobInputError('이 잡은 실행 옵션을 지원하지 않음');
  }
  // 인자는 레지스트리에 고정된 값만 사용한다. 사용자 입력은 위에서 이미 거부하므로
  // 표준 잡으로 임의 인자가 흘러 들어갈 수 없다.
  return ['run', job.script, ...(job.args ?? [])];
};
