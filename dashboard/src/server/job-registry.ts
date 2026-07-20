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
    id: 'test-run',
    label: '테스트 실행 (1분 지연)',
    script: 'cron:p',
    description: '노출체크 전체 워크플로우를 테스트 지연으로 실행',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'root-crawl',
    label: '루트 키워드 크롤',
    script: 'cron:root',
    description: '루트 키워드 전용 노출체크',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'pages-package',
    label: '패키지 시트 페이지 체크',
    script: 'cron:pages:package',
    description: '패키지 시트 멀티페이지 노출체크',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'pages-general',
    label: '일반 시트 페이지 체크',
    script: 'cron:pages:general',
    description: '일반(도그마루 제외) 시트 멀티페이지 노출체크',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'dogmaru',
    label: '도그마루 크롤',
    script: 'cron:dogmaru',
    description: '도그마루 전용 노출체크',
    kind: 'standard',
    resourceGroup: 'exposure',
  },
  {
    id: 'dogmaru-exclude',
    label: '도그마루 제외 크롤',
    script: 'cron:exclude',
    description: '도그마루 제외 노출체크',
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
