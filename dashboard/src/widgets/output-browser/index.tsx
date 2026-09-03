'use client';

import React from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { Card, SectionHeader, cn, formatBytes, formatDateTime } from '@/shared';
import { getOutputDownloadUrl, useOutputFileList } from '@/entities/output-file';
import type { OutputFileEntry } from '@/entities/output-file';

const FILE_ICON_CLASS_NAME = 'size-4 shrink-0 text-[var(--ink-faint)]';

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
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-[var(--line)]/40"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {renderFileIcon(file.fileName)}
        <span className="truncate text-[var(--ink)]">{file.relativePath}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-[var(--ink-faint)]">
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
        title="결과 파일"
        description="노출체크가 끝날 때마다 쌓이는 결과 파일입니다"
        action={
          data && data.files.length > 0 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder="파일명 검색"
                className={cn(
                  'w-40 rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1.5 pl-8 pr-2.5 text-xs outline-none transition',
                  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/25',
                  'dark:border-neutral-700',
                )}
              />
            </div>
          ) : null
        }
      />
      {isLoading ? (
        <p className="text-sm text-[var(--ink-soft)]">불러오는 중</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-[var(--alert)]">파일 목록을 불러오지 못했습니다</p>
      ) : null}
      {data ? (
        <div className="flex flex-col">
          {filteredFiles.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              {search ? '검색 결과가 없습니다' : '아직 만들어진 결과 파일이 없습니다'}
            </p>
          ) : null}
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {filteredFiles.map((file) => (
              <OutputFileRow key={file.relativePath} file={file} />
            ))}
          </div>
          {!search && data.totalCount > data.files.length ? (
            <p className="pt-2 text-xs text-[var(--ink-faint)]">
              {data.files.length}/{data.totalCount}개 표시됨 (최신순)
            </p>
          ) : null}
          {search && filteredFiles.length > 0 ? (
            <p className="pt-2 text-xs text-[var(--ink-faint)]">{filteredFiles.length}개 검색됨</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
