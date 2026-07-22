export interface CustomExposureInputRow {
  sheetRow: number;
  company: string;
  keyword: string;
}

export interface CustomExposureCheckedResult {
  exposureStatus: '노출' | '미노출' | '확인실패';
  rank: string;
  name: string;
  links: string;
}
