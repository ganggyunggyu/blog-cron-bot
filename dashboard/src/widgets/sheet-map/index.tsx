'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge, Card, SectionHeader, cn } from '@/shared';
import { CHECK_KIND_SHORT_LABELS, usePreset, type CheckKind } from '@/entities/preset';
import { resolveResult, sheetUrl, spreadsheetLabel } from './model';

const KIND_TONE: Record<CheckKind, 'neutral' | 'warning' | 'success'> = {
  basic: 'neutral',
  more: 'warning',
  page: 'success',
};

const SheetLink = ({
  sheetId,
  tabTitle,
}: {
  sheetId: string;
  tabTitle: string;
}) => (
  <a
    href={sheetUrl({ sheetId, tabTitle })}
    target="_blank"
    rel="noreferrer"
    className="group inline-flex items-start gap-1 text-left hover:underline"
  >
    <span>
      <span className="block text-[13px] text-[var(--ink)]">{spreadsheetLabel(sheetId)}</span>
      <span className="stamp">{tabTitle}</span>
    </span>
    <ExternalLink className="mt-0.5 size-3 shrink-0 text-[var(--ink-faint)] group-hover:text-[var(--ink-soft)]" />
  </a>
);

const toErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? fallback;
};

/**
 * 대상별로 어떤 시트에서 키워드를 읽어서 어떤 시트에 결과를 쓰는지 한눈에 보여준다.
 *
 * 프리셋 설정 화면(/settings)엔 대상마다 계정·페이지수는 있어도 원본/결과 시트는
 * 안 보여서, 어느 시트로 나가는지 물어볼 때마다 코드를 뒤져야 했다. pet(애견)처럼
 * 프리셋에 result가 비어 있지만 코드에 결과 시트가 따로 고정된 경우는 그렇다고
 * 표시한다(model.ts의 HARDCODED_RESULT_OVERRIDES 참고).
 */
export const SheetMap = () => {
  const { data, isLoading, error } = usePreset();

  if (isLoading) {
    return (
      <Card>
        <p className="text-[13px] text-[var(--ink-soft)]">시트 매핑 불러오는 중</p>
      </Card>
    );
  }

  const preset = data?.preset;
  if (error || !preset) {
    return (
      <Card>
        <p className="text-[13px] text-[var(--alert)]">
          {toErrorMessage(error, '프리셋을 불러오지 못함')}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="원본 → 결과 시트"
        description="체크마다 키워드를 어디서 읽고 결과를 어디에 쓰는지 보여줍니다"
      />
      <div className="flex flex-col divide-y divide-[var(--line)]">
        {preset.targets.map((target) => {
          const result = resolveResult(target);

          return (
            <div
              key={target.id}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 py-3',
                !target.enabled && 'opacity-50',
              )}
            >
              <div>
                <span className="block text-[13px] font-medium text-[var(--ink)]">
                  {target.label}
                </span>
                <span className="stamp">{target.id}</span>
              </div>

              <Badge tone={KIND_TONE[target.kind]}>{CHECK_KIND_SHORT_LABELS[target.kind]}</Badge>

              <SheetLink sheetId={target.source.sheetId} tabTitle={target.source.tabTitle} />

              {result.location ? (
                <div className="flex items-start gap-1.5">
                  <SheetLink
                    sheetId={result.location.sheetId}
                    tabTitle={result.location.tabTitle}
                  />
                  {result.isHardcodedOverride ? (
                    <span
                      className="stamp shrink-0"
                      title="설정에는 없지만 결과를 쓸 시트가 봇에 정해져 있습니다"
                    >
                      코드고정
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-[13px] text-[var(--ink-faint)]">원본 시트에 그대로 반영</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
