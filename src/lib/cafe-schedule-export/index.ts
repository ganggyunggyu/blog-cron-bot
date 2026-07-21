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

export const buildCafeScheduleExportRows = (
  sourceRows: CafeScheduleSourceRow[],
  checkedRows: CafeScheduleCheckRow[],
  allowMissingResults = false
): CafeScheduleExportRow[] => {
  const resultQueues = new Map<string, CafeScheduleCheckRow[]>();
  checkedRows.forEach((row) => {
    const queue = resultQueues.get(row.keyword) ?? [];
    queue.push(row);
    resultQueues.set(row.keyword, queue);
  });

  return sourceRows.map(({ row, keyword }) => {
    const result = keyword ? resultQueues.get(keyword)?.shift() : undefined;

    if (keyword && !result && !allowMissingResults) {
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
