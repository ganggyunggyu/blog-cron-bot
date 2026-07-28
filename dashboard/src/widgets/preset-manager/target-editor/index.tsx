'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, cn } from '@/shared';
import {
  CHECK_KINDS,
  CHECK_KIND_LABELS,
  CHECK_KIND_SHORT_LABELS,
  type PresetTarget,
} from '@/entities/preset';
import { blogIdsToText, isCheckKind, textToBlogIds } from '../model';

const FIELD_STYLE = cn(
  'w-full rounded border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2',
  'text-[13px] text-[var(--ink)] outline-none transition-colors',
  'placeholder:text-[var(--ink-faint)]',
  'focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--signal)]/20',
);

interface FieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const Field = ({ label, children, className }: FieldProps) => (
  <label className={cn('flex flex-col gap-1.5', className)}>
    <span className="stamp">{label}</span>
    {children}
  </label>
);

interface TargetEditorProps {
  target: PresetTarget;
  onChange: (index: number, next: PresetTarget) => void;
  onRemove: (index: number) => void;
  index: number;
}

export const TargetEditor = ({
  target,
  onChange,
  onRemove,
  index,
}: TargetEditorProps) => {
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...target, label: event.target.value });
  };

  const handleIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...target, id: event.target.value });
  };

  const handleKindChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const kind = event.target.value;
    if (!isCheckKind(kind)) return;
    onChange(index, {
      ...target,
      kind,
      maxPages: kind === 'page' ? (target.maxPages ?? 4) : undefined,
    });
  };

  const handleSourceSheetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      source: { ...target.source, sheetId: event.target.value },
    });
  };

  const handleSourceTabChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      source: { ...target.source, tabTitle: event.target.value },
    });
  };

  const handleResultSheetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      result: {
        sheetId: event.target.value,
        tabTitle: target.result?.tabTitle ?? '',
      },
    });
  };

  const handleResultTabChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, {
      ...target,
      result: {
        sheetId: target.result?.sheetId ?? '',
        tabTitle: event.target.value,
      },
    });
  };

  const handleMaxPagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    onChange(index, {
      ...target,
      maxPages: raw === '' ? undefined : Number(raw),
    });
  };

  const handleBlogIdsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const blogIds = textToBlogIds(event.target.value);
    onChange(index, {
      ...target,
      blogIds: blogIds.length > 0 ? blogIds : undefined,
    });
  };

  const handleEnabledToggle = () => {
    onChange(index, { ...target, enabled: !target.enabled });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  const writesToSource = !target.result?.sheetId && !target.result?.tabTitle;

  return (
    <div
      className={cn(
        'relative rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4',
        'before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-full',
        target.enabled
          ? 'before:bg-[var(--signal)]'
          : 'opacity-60 before:bg-[var(--ink-faint)]',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 pl-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={target.enabled ? 'success' : 'neutral'} withDot>
            {CHECK_KIND_SHORT_LABELS[target.kind]}
          </Badge>
          <span className="tabular truncate text-[11px] text-[var(--ink-faint)]">
            {target.id}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleEnabledToggle}>
            {target.enabled ? '실행 끄기' : '실행 켜기'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            aria-label={`${target.label} 대상 삭제`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 pl-3 sm:grid-cols-2">
        <Field label="이름">
          <input
            value={target.label}
            onChange={handleLabelChange}
            placeholder="패키지"
            className={FIELD_STYLE}
          />
        </Field>

        <Field label="대상 id">
          <input
            value={target.id}
            onChange={handleIdChange}
            placeholder="package"
            className={cn(FIELD_STYLE, 'tabular')}
          />
        </Field>

        <Field label="노출체크 종류">
          <select
            value={target.kind}
            onChange={handleKindChange}
            className={FIELD_STYLE}
          >
            {CHECK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {CHECK_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>

        {target.kind === 'page' ? (
          <Field label="몇 페이지까지">
            <input
              type="number"
              min={1}
              max={10}
              value={target.maxPages ?? ''}
              onChange={handleMaxPagesChange}
              placeholder="4"
              className={cn(FIELD_STYLE, 'tabular')}
            />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="읽기 시트 ID">
          <input
            value={target.source.sheetId}
            onChange={handleSourceSheetChange}
            placeholder="1AbC..."
            className={cn(FIELD_STYLE, 'tabular')}
          />
        </Field>

        <Field label="읽기 탭">
          <input
            value={target.source.tabTitle}
            onChange={handleSourceTabChange}
            placeholder="패키지"
            className={FIELD_STYLE}
          />
        </Field>

        <Field label="쓰기 시트 ID">
          <input
            value={target.result?.sheetId ?? ''}
            onChange={handleResultSheetChange}
            placeholder="비우면 읽기 시트에 반영"
            className={cn(FIELD_STYLE, 'tabular')}
          />
        </Field>

        <Field label="쓰기 탭">
          <input
            value={target.result?.tabTitle ?? ''}
            onChange={handleResultTabChange}
            placeholder="비우면 읽기 시트에 반영"
            className={FIELD_STYLE}
          />
        </Field>

        <Field label="블로그 계정 (비우면 전체)" className="sm:col-span-2">
          <textarea
            value={blogIdsToText(target.blogIds)}
            onChange={handleBlogIdsChange}
            rows={2}
            placeholder="introsm, airtrd"
            className={cn(FIELD_STYLE, 'resize-y')}
          />
        </Field>
      </div>

      {writesToSource ? (
        <p className="mt-3 pl-3 text-[12px] text-[var(--ink-soft)]">
          결과를 읽기 시트에 그대로 덮어씀
        </p>
      ) : null}
    </div>
  );
};
