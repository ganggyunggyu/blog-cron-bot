export interface CafeScheduleSourceRow {
  row: number;
  keyword: string;
}

export interface CafeScheduleCheckRow extends CafeScheduleSourceRow {
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  name: string;
  links: string;
}

export interface CafeScheduleExportRow {
  [key: string]: string;
  키워드: string;
  노출여부: string;
  순위: string;
  카페블로그명: string;
  링크: string;
}

const keywordKey = (keyword: string): string => keyword.trim();
const isScheduleMarker = (value: unknown): boolean =>
  /스케[줄쥴]/.test(String(value ?? '').trim());

export const extractLatestCafeScheduleSourceRows = (
  values: unknown[][]
): CafeScheduleSourceRow[] => {
  let markerRowIndex = -1;
  values.forEach((row, rowIndex) => {
    if (isScheduleMarker(row?.[0])) markerRowIndex = rowIndex;
  });
  if (markerRowIndex < 0) throw new Error('A열 스케줄 제목을 찾지 못함');

  let lastScheduleRowIndex = markerRowIndex;
  for (let rowIndex = markerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
    if (isScheduleMarker(values[rowIndex]?.[0])) break;
    if (String(values[rowIndex]?.[0] ?? '').trim()) {
      lastScheduleRowIndex = rowIndex;
    }
  }

  return values
    .slice(markerRowIndex + 1, lastScheduleRowIndex + 1)
    .map((row, rowOffset) => ({
      row: markerRowIndex + rowOffset + 2,
      keyword: String(row?.[0] ?? ''),
    }));
};

export const buildCafeScheduleExportRows = (
  sourceRows: CafeScheduleSourceRow[],
  checkedRows: CafeScheduleCheckRow[],
  allowMissingResults = false
): CafeScheduleExportRow[] => {
  const resultQueues = new Map<string, CafeScheduleCheckRow[]>();
  const fallbackResults = new Map<string, CafeScheduleCheckRow>();
  checkedRows.forEach((row) => {
    const key = keywordKey(row.keyword);
    const queue = resultQueues.get(key) ?? [];
    queue.push(row);
    resultQueues.set(key, queue);
    if (!fallbackResults.has(key)) fallbackResults.set(key, row);
  });

  return sourceRows.map(({ row, keyword }) => {
    const key = keywordKey(keyword);
    const result = key
      ? resultQueues.get(key)?.shift() ?? fallbackResults.get(key)
      : undefined;

    if (key && !result && !allowMissingResults) {
      throw new Error(`${row}행 ${keyword} 결과가 artifact에 없음`);
    }

    return {
      키워드: keyword,
      노출여부: result?.exposureStatus === '노출' ? 'o' : '',
      순위: result?.rank ?? '',
      카페블로그명: result?.name ?? '',
      링크: result?.links ?? '',
    };
  });
};
