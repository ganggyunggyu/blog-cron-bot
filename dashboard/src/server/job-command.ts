import { buildExposureSuiteArgs } from './exposure-suite-options';
import { InvalidJobInputError } from './job-errors';
import type { JobDefinition } from './job-registry';
import type { ExposureTargetId } from '@/shared';
import { buildRootCafeUrlArgs } from './root-cafe-url-options';

const isEmptyOptionsObject = (input: unknown): boolean =>
  typeof input === 'object' &&
  input !== null &&
  !Array.isArray(input) &&
  Object.keys(input).length === 0;

export const buildJobSpawnArgs = (
  job: JobDefinition,
  input: unknown,
  allowedTargets?: readonly ExposureTargetId[],
): string[] => {
  if (job.kind === 'exposure-suite') {
    const options = buildExposureSuiteArgs(input, allowedTargets);
    return ['run', job.script, ...options];
  }

  if (job.kind === 'root-cafe-url') {
    const options = buildRootCafeUrlArgs(input);
    return ['run', job.script, ...options];
  }

  // 카페 체크는 시트를 환경변수로 받으므로 인자가 없다.
  if (job.kind === 'cafe-check') return ['run', job.script];

  if (input !== undefined && !isEmptyOptionsObject(input)) {
    throw new InvalidJobInputError('이 항목은 실행 옵션을 받지 않음');
  }
  // 인자는 레지스트리에 고정된 값만 사용한다. 사용자 입력은 위에서 이미 거부하므로
  // 표준 잡으로 임의 인자가 흘러 들어갈 수 없다.
  return ['run', job.script, ...(job.args ?? [])];
};
