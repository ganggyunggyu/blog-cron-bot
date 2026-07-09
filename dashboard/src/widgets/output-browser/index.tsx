'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Card, formatBytes, formatDateTime } from '@/shared';
import { getOutputDownloadUrl, useOutputFileList } from '@/entities/output-file';

export const OutputBrowser = () => {
  const { data, isLoading, isError } = useOutputFileList();

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        결과 파일
      </h2>
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">불러오는 중...</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">파일 목록을 불러오지 못함</p>
      ) : null}
      {data ? (
        <div className="flex flex-col">
          {data.files.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              생성된 결과 파일이 없음.
            </p>
          ) : null}
          {data.files.map((file) => (
            <a
              key={file.relativePath}
              href={getOutputDownloadUrl(file.relativePath)}
              className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
            >
              <span className="truncate text-neutral-700 dark:text-neutral-300">
                {file.relativePath}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-neutral-400">
                {formatBytes(file.sizeBytes)}
                {formatDateTime(file.modifiedAt)}
                <Download className="size-3.5" />
              </span>
            </a>
          ))}
          {data.totalCount > data.files.length ? (
            <p className="pt-2 text-xs text-neutral-400">
              {data.files.length}/{data.totalCount}개 표시됨 (최신순)
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
