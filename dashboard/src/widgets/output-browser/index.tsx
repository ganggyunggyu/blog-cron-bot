'use client';

import React from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, FolderOpen, Search } from 'lucide-react';
import { Card, SectionHeader, cn, formatBytes, formatDateTime } from '@/shared';
import { getOutputDownloadUrl, useOutputFileList } from '@/entities/output-file';
import type { OutputFileEntry } from '@/entities/output-file';

const FILE_ICON_CLASS_NAME = 'size-4 shrink-0 text-neutral-400';

const renderFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'csv' || extension === 'xlsx') {
    return <FileSpreadsheet className={FILE_ICON_CLASS_NAME} />;
  }
  if (extension === 'json') {
    return <FileJson className={FILE_ICON_CLASS_NAME} />;
  }
  return <FileText className={FILE_ICON_CLASS_NAME} />;
};

interface OutputFileRowProps {
  file: OutputFileEntry;
}

const OutputFileRow = ({ file }: OutputFileRowProps) => {
  return (
    <a
      href={getOutputDownloadUrl(file.relativePath)}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {renderFileIcon(file.fileName)}
        <span className="truncate text-neutral-700 dark:text-neutral-300">
          {file.relativePath}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-neutral-400">
        {formatBytes(file.sizeBytes)}
        {formatDateTime(file.modifiedAt)}
        <Download className="size-3.5" />
      </span>
    </a>
  );
};

export const OutputBrowser = () => {
  const { data, isLoading, isError } = useOutputFileList();
  const [search, setSearch] = React.useState('');

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const filteredFiles = React.useMemo(() => {
    if (!data) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data.files;
    return data.files.filter((file) => file.relativePath.toLowerCase().includes(keyword));
  }, [data, search]);

  return (
    <Card>
      <SectionHeader
        icon={FolderOpen}
        title="결과 파일"
        description="크론 실행 결과 CSV/파일 목록"
        action={
          data && data.files.length > 0 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                aria-label="결과 파일명 검색"
                value={search}
                onChange={handleSearchChange}
                placeholder="파일명 검색"
                className={cn(
                  'w-40 rounded-lg border border-neutral-300 bg-white py-1.5 pl-8 pr-2.5 text-xs outline-none transition',
                  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                  'dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
                )}
              />
            </div>
          ) : null
        }
      />
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">파일 목록을 불러오지 못함</p>
      ) : null}
      {data ? (
        <div className="flex flex-col">
          {filteredFiles.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {search ? '검색 결과가 없음.' : '생성된 결과 파일이 없음.'}
            </p>
          ) : null}
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {filteredFiles.map((file) => (
              <OutputFileRow key={file.relativePath} file={file} />
            ))}
          </div>
          {!search && data.totalCount > data.files.length ? (
            <p className="pt-2 text-xs text-neutral-400">
              {data.files.length}/{data.totalCount}개 표시됨 (최신순)
            </p>
          ) : null}
          {search && filteredFiles.length > 0 ? (
            <p className="pt-2 text-xs text-neutral-400">{filteredFiles.length}개 검색됨</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
