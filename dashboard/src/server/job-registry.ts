export interface JobDefinition {
  id: string;
  label: string;
  script: string;
  description: string;
  riskNote?: string;
}

export const JOB_REGISTRY: JobDefinition[] = [
  {
    id: 'test-run',
    label: '테스트 실행 (1분 지연)',
    script: 'cron:p',
    description: '노출체크 전체 워크플로우를 테스트 지연으로 실행',
  },
  {
    id: 'root-crawl',
    label: '루트 키워드 크롤',
    script: 'cron:root',
    description: '루트 키워드 전용 노출체크',
  },
  {
    id: 'pages-package',
    label: '패키지 시트 페이지 체크',
    script: 'cron:pages:package',
    description: '패키지 시트 멀티페이지 노출체크',
  },
  {
    id: 'pages-general',
    label: '일반 시트 페이지 체크',
    script: 'cron:pages:general',
    description: '일반(도그마루 제외) 시트 멀티페이지 노출체크',
  },
  {
    id: 'dogmaru',
    label: '도그마루 크롤',
    script: 'cron:dogmaru',
    description: '도그마루 전용 노출체크',
    riskNote: '종료 시 브라우저 프로세스가 잔류할 수 있음 (closeBrowser 미호출)',
  },
  {
    id: 'dogmaru-exclude',
    label: '도그마루 제외 크롤',
    script: 'cron:exclude',
    description: '도그마루 제외 노출체크',
    riskNote: '종료 시 브라우저 프로세스가 잔류할 수 있음 (closeBrowser 미호출)',
  },
  {
    id: 'parallel-check',
    label: '병렬 직접 시트 체크',
    script: 'parallel:check',
    description: '시트 직접 접근 병렬 노출체크 (finally cleanup 보장, 가장 안전)',
  },
  {
    id: 'cafe-check',
    label: '카페 노출체크',
    script: 'cafe:check',
    description: 'HTTP 전용 카페 노출체크 (브라우저 미사용)',
  },
];

export const getJobDefinition = (id: string) => JOB_REGISTRY.find((job) => job.id === id);
