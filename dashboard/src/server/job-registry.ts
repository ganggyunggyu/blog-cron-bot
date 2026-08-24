import { EXPOSURE_SUITE_OPTION_DEFINITION } from './exposure-suite-options';
import type { ExposureExecutionMode } from '@/shared';

const IS_DISTRIBUTED_EXPOSURE_ENABLED =
  process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true';

export type JobKind = 'standard' | 'exposure-suite' | 'root-cafe-url';
export type JobResourceGroup = 'exposure';

/** 화면에서 잡을 묶어 보여줄 분류. 14개가 한 줄로 나열되면 뭘 눌러야 할지 알 수 없다. */
export type JobCategory = 'daily' | 'more' | 'pet' | 'cafe' | 'reexport';

export interface JobDefinition {
  id: string;
  label: string;
  script: string;
  args?: string[];
  description: string;
  riskNote?: string;
  kind: JobKind;
  category?: JobCategory;
  resourceGroup?: JobResourceGroup;
  options?: typeof EXPOSURE_SUITE_OPTION_DEFINITION;
  executionMode?: ExposureExecutionMode;
}

/**
 * 대상 1개짜리 개별 노출체크가 실행할 명령을 고른다.
 *
 * 로컬 스크립트(cron:sheet, cron:pages 등)는 이 레포에 존재하지 않는 외부 시트 API
 * (SHEET_APP_URL / PAGE_CHECK_API)에 의존해서 원격 배포 환경에서는 항상 실패한다.
 * 분산 실행이 켜져 있으면 전체 실행과 똑같이 검증된 분산 러너로 보내, 개별 실행도
 * 원본 시트를 직접 읽고 결과 반영과 Dooray 전송까지 같은 경로로 처리하게 한다.
 */
const resolveTargetJobCommand = (
  target: string,
  localScript: string,
  extraArgs: readonly string[] = [],
): Pick<JobDefinition, 'script' | 'args'> =>
  IS_DISTRIBUTED_EXPOSURE_ENABLED
    ? {
        script: 'exposure:distributed',
        args: [`--targets=${target}`, ...extraArgs],
      }
    : { script: localScript };

export const JOB_REGISTRY: JobDefinition[] = [
  {
    id: 'package-exposure',
    label: '패키지',
    ...resolveTargetJobCommand('package', 'exposure:package'),
    description: '패키지 시트 키워드의 노출 확인',
    kind: 'standard',
    category: 'daily',
    resourceGroup: 'exposure',
  },
  {
    id: 'general-exposure',
    label: '일반건',
    ...resolveTargetJobCommand('general', 'exposure:general'),
    description: '도그마루를 뺀 일반건 시트 키워드의 노출 확인',
    kind: 'standard',
    category: 'daily',
    resourceGroup: 'exposure',
  },
  {
    id: 'dogmaru-exposure',
    label: '도그마루',
    ...resolveTargetJobCommand('dogmaru', 'exposure:dogmaru'),
    description: '도그마루 시트 키워드의 노출 확인',
    kind: 'standard',
    category: 'daily',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-exposure',
    label: '루트',
    ...resolveTargetJobCommand('root', 'cron:root'),
    description: '루트(월보장) 시트 키워드의 노출 확인',
    kind: 'standard',
    category: 'daily',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-cafe-url-exposure',
    label: '루트 · 카페 URL',
    script: 'exposure:root:cafe-url',
    description: '카페 글 URL 하나를 붙여넣으면 루트 키워드 전체에서 그 글이 노출되는지 확인',
    kind: 'root-cafe-url',
    category: 'cafe',
    resourceGroup: 'exposure',
  },
  {
    id: 'package-general-dogmaru-more-exposure',
    label: '패키지 · 일반건 · 도그마루',
    script: 'exposure:distributed:more',
    description: '세 시트의 인기글 더보기를 한 번에 확인하고 결과를 합쳐서 반영',
    riskNote: '더보기를 끝까지 펼쳐서 일반 노출체크보다 오래 걸림',
    kind: 'standard',
    category: 'more',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-more-exposure',
    label: '루트',
    // 단일 프로세스로 돌던 시절 708개 키워드에 5시간이 걸려 분산 경로로 옮겼다.
    script: 'exposure:distributed:more',
    args: ['--targets=root'],
    description: '루트 시트의 인기글 더보기를 끝까지 확인',
    riskNote: '더보기를 끝까지 펼쳐서 일반 노출체크보다 오래 걸림',
    kind: 'standard',
    category: 'more',
    resourceGroup: 'exposure',
  },
  {
    id: 'dogmaru-more-finalize',
    label: '도그마루 결과만 내보내기',
    script: 'exposure:more:finalize:dogmaru',
    description: '이미 끝난 도그마루 더보기 결과를 시트에 반영하고 두레이로 발송',
    kind: 'standard',
    category: 'more',
    resourceGroup: 'exposure',
  },
  {
    id: 'pet-exposure',
    label: '애견 (1페이지)',
    ...resolveTargetJobCommand('pet', 'exposure:pet', ['--max-pages=1']),
    description: '애견 시트 키워드를 1페이지까지 확인',
    kind: 'standard',
    category: 'pet',
    resourceGroup: 'exposure',
  },
  {
    id: 'pet-exposure-9-direct',
    label: '애견 (1~9페이지)',
    script: 'exposure:pet:9-direct',
    description: '애견 시트 전체를 9페이지까지 더 깊게 확인',
    riskNote: '검사 범위가 넓어 1페이지보다 오래 걸림',
    kind: 'standard',
    category: 'pet',
    resourceGroup: 'exposure',
  },
  {
    id: 'suripet-exposure',
    label: '서리펫 (1페이지)',
    ...resolveTargetJobCommand('suripet', 'exposure:suripet', ['--max-pages=1']),
    description: '서리펫 시트 키워드를 1페이지까지 확인',
    kind: 'standard',
    category: 'pet',
    resourceGroup: 'exposure',
  },
  {
    id: 'cafe-exposure',
    label: '카페 + 블로그',
    ...resolveTargetJobCommand('cafe', 'exposure:cafe'),
    description: '카페 발행스케줄의 카페와 블로그 노출을 함께 확인',
    kind: 'standard',
    category: 'cafe',
    resourceGroup: 'exposure',
  },
  {
    id: 'custom-cafe-0722',
    label: '카페 0722',
    script: 'exposure:custom-cafe-0722',
    description: '업로드해둔 0722 키워드의 카페·블로그 노출 확인',
    kind: 'standard',
    category: 'cafe',
    resourceGroup: 'exposure',
  },
  {
    id: 'reexport-current-exposure',
    label: '노출체크 결과',
    script: 'exposure:reexport:current',
    description: '재검사 없이, 지금 저장된 결과만 시트에 다시 반영',
    kind: 'standard',
    category: 'reexport',
    resourceGroup: 'exposure',
  },
  {
    id: 'reexport-current-cafe',
    label: '카페 결과',
    script: 'exposure:reexport:cafe',
    description: '재검사 없이, 지금 저장된 카페 결과만 시트에 다시 반영',
    kind: 'standard',
    category: 'reexport',
    resourceGroup: 'exposure',
  },
  {
    id: 'exposure-suite',
    label: IS_DISTRIBUTED_EXPOSURE_ENABLED
      ? '전체 다중 워커 노출체크'
      : '전체 빠른 노출체크',
    script: IS_DISTRIBUTED_EXPOSURE_ENABLED
      ? 'exposure:distributed'
      : 'exposure:suite',
    description: IS_DISTRIBUTED_EXPOSURE_ENABLED
      ? '패키지·일반건·도그마루·루트·애견·서리펫·카페를 한 번에 확인'
      : '선택한 시트를 한 번에 확인',
    kind: 'exposure-suite',
    resourceGroup: 'exposure',
    options: EXPOSURE_SUITE_OPTION_DEFINITION,
    executionMode: IS_DISTRIBUTED_EXPOSURE_ENABLED ? 'distributed' : 'local',
  },
];

export const getJobDefinition = (id: string) => JOB_REGISTRY.find((job) => job.id === id);
