export const EXPOSURE_TARGETS = [
  { id: 'package', label: '패키지', description: '원본 시트는 읽기만 하고 결과는 결과 시트에 씁니다' },
  { id: 'general', label: '일반건', description: '도그마루를 뺀 나머지 키워드를 확인합니다' },
  { id: 'dogmaru', label: '도그마루', description: '도그마루 계정으로 애견 검색까지 함께 확인합니다' },
  { id: 'root', label: '루트', description: '루트(월보장) 키워드를 확인합니다' },
  { id: 'pet', label: '애견', description: '애견 시트를 정한 페이지까지 확인합니다' },
  { id: 'suripet', label: '서리펫', description: '서리펫 시트를 정한 페이지까지 확인합니다' },
  { id: 'cafe', label: '카페 + 블로그', description: '카페 발행스케줄의 카페와 블로그를 함께 확인합니다' },
] as const;

export type ExposureTargetId = (typeof EXPOSURE_TARGETS)[number]['id'];
export type ExposureExecutionMode = 'local' | 'distributed';

export const EXPOSURE_PROGRESS_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(EXPOSURE_TARGETS.map(({ id, label }) => [id, label])),
  'root-more': '루트 더보기',
  // 7개 대상에는 없지만 진행률은 따로 올라온다. 'root'로 합치면 루트 진행바를 덮어쓴다.
  'root-cafe-url': '루트 · 카페 URL',
};
