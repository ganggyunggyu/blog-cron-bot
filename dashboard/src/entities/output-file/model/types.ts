export interface OutputFileEntry {
  relativePath: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface OutputFileListResult {
  files: OutputFileEntry[];
  totalCount: number;
}
