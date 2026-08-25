export const EXPOSURE_TARGETS = [
  { id: 'package', label: '패키지', description: '원본 시트는 읽기만 하고 결과는 결과 시트에 씀' },
  { id: 'general', label: '일반건', description: '도그마루를 뺀 나머지 키워드를 봄' },
  { id: 'dogmaru', label: '도그마루', description: '도그마루 계정으로 애견 검색까지 같이 봄' },
  { id: 'root', label: '루트', description: '루트(월보장) 키워드를 봄' },
  { id: 'pet', label: '애견', description: '애견 시트를 정한 페이지까지 봄' },
  { id: 'suripet', label: '서리펫', description: '서리펫 시트를 정한 페이지까지 봄' },
  { id: 'cafe', label: '카페 + 블로그', description: '카페 발행스케줄의 카페와 블로그를 같이 봄' },
] as const;

export type ExposureTargetId = (typeof EXPOSURE_TARGETS)[number]['id'];
export type ExposureExecutionMode = 'local' | 'distributed';

export const EXPOSURE_PROGRESS_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(EXPOSURE_TARGETS.map(({ id, label }) => [id, label])),
  'root-more': '루트 더보기',
};
