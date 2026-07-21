export const EXPOSURE_TARGETS = [
  { id: 'package', label: '패키지', description: '원본은 읽고 결과 시트에만 반영' },
  { id: 'general', label: '일반건', description: '일반건 전용 노출체크' },
  { id: 'dogmaru', label: '도그마루', description: '애견 검색 공유·전용 결과 반영' },
  { id: 'root', label: '루트', description: '루트 키워드 전용 노출체크' },
  { id: 'pet', label: '애견', description: '애견 시트 페이지 노출체크' },
  { id: 'suripet', label: '서리펫', description: '서리펫 시트 페이지 노출체크' },
  { id: 'cafe', label: '카페 + 블로그', description: '카페 발행 스케줄 통합 노출체크' },
] as const;

export type ExposureTargetId = (typeof EXPOSURE_TARGETS)[number]['id'];
export type ExposureExecutionMode = 'local' | 'distributed';

export const EXPOSURE_PROGRESS_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(EXPOSURE_TARGETS.map(({ id, label }) => [id, label])),
  'root-more': '루트 더보기',
};
