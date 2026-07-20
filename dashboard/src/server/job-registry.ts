import { EXPOSURE_SUITE_OPTION_DEFINITION } from './exposure-suite-options';

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
    script: 'exposure:root',
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
    id: 'exposure-suite',
    label: '전체 빠른 노출체크',
    script: 'exposure:suite',
    description: '선택한 노출체크를 공통 병렬 예산 안에서 실행',
    kind: 'exposure-suite',
    resourceGroup: 'exposure',
    options: EXPOSURE_SUITE_OPTION_DEFINITION,
  },
];

export const getJobDefinition = (id: string) => JOB_REGISTRY.find((job) => job.id === id);
