import { EXPOSURE_SUITE_OPTION_DEFINITION } from './exposure-suite-options';
import type { ExposureExecutionMode } from '@/shared';

const IS_DISTRIBUTED_EXPOSURE_ENABLED =
  process.env.DISTRIBUTED_EXPOSURE_ENABLED === 'true';

export type JobKind = 'standard' | 'exposure-suite';
export type JobResourceGroup = 'exposure';

export interface JobDefinition {
  id: string;
  label: string;
  script: string;
  description: string;
  riskNote?: string;
  kind: JobKind;
  resourceGroup?: JobResourceGroup;
  options?: typeof EXPOSURE_SUITE_OPTION_DEFINITION;
  executionMode?: ExposureExecutionMode;
}

export const JOB_REGISTRY: JobDefinition[] = [
  {
    id: 'package-exposure',
    label: '패키지 노출체크',
    script: 'exposure:package',
    description: '패키지 노출을 확인하고 결과 시트와 알림까지 처리',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'general-exposure',
    label: '일반건 노출체크',
    script: 'exposure:general',
    description: '도그마루를 제외한 일반건 노출을 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'dogmaru-exposure',
    label: '도그마루 노출체크',
    script: 'exposure:dogmaru',
    description: '도그마루 전용 노출을 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-exposure',
    label: '루트 노출체크',
    script: 'cron:root',
    description: '루트 키워드 전용 노출을 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-more-exposure',
    label: '루트 더보기 노출체크',
    script: 'old-logic:more-check:root',
    description: '루트 구로직 인기글 더보기 전체 결과를 확인',
    riskNote: '더보기 전체를 여는 작업이라 일반 노출체크보다 오래 걸릴 수 있음',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'pet-exposure',
    label: '애견 노출체크',
    script: 'exposure:pet',
    description: '애견 1~4페이지를 공통 요청 제한 안에서 병렬 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'pet-exposure-9-direct',
    label: '애견 1~9페이지 직접 노출체크',
    script: 'exposure:pet:9-direct',
    description: '애견(전체블로그) 300행을 원격에서 9페이지까지 병렬 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'suripet-exposure',
    label: '서리펫 노출체크',
    script: 'exposure:suripet',
    description: '서리펫 1~4페이지를 공통 요청 제한 안에서 병렬 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'cafe-exposure',
    label: '카페 + 블로그 노출체크',
    script: 'exposure:cafe',
    description: '카페 발행스케줄의 카페·블로그 노출을 함께 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'custom-cafe-0722',
    label: '카페 노출체크 0722',
    script: 'exposure:custom-cafe-0722',
    description: '업로드 키워드의 카페·블로그 노출을 통합 확인',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'reexport-current-exposure',
    label: '현재 결과 원본 순서 재내보내기',
    script: 'exposure:reexport:current',
    description: '노출체크 없이 현재 결과를 원본 키워드 순서로 다시 반영',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'reexport-current-cafe',
    label: '카페 현재 결과 재내보내기',
    script: 'exposure:reexport:cafe',
    description: '노출 재검사 없이 카페 현재 결과만 원본 순서로 다시 반영',
    kind: 'standard',
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
      ? '선택한 노출체크를 여러 실행 서버에 자동 분배'
      : '선택한 노출체크를 제어 서버에서 병렬 실행',
    kind: 'exposure-suite',
    resourceGroup: 'exposure',
    options: EXPOSURE_SUITE_OPTION_DEFINITION,
    executionMode: IS_DISTRIBUTED_EXPOSURE_ENABLED ? 'distributed' : 'local',
  },
];

export const getJobDefinition = (id: string) => JOB_REGISTRY.find((job) => job.id === id);
