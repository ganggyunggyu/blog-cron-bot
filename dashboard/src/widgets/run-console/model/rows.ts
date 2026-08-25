import type { JobDefinition } from '@/entities/job';

export interface CheckRow {
  /** 이 줄을 대표하는 이름. 대상이 있으면 대상 이름, 없으면 잡 이름. */
  label: string;
  /** 이 줄에서 고를 수 있는 잡. 2개 이상이면 화면이 선택기를 그린다. */
  jobs: JobDefinition[];
  /** 묶음/전체 실행에 넣을 수 있는 대상. 더보기와 도구는 없다. */
  targetId?: string;
  riskNote?: string;
}

/**
 * 잡 목록을 화면에 그릴 줄로 바꾼다.
 *
 * 한 대상에 잡이 둘인 경우(애견 1페이지 / 1~9페이지)를 한 줄로 합친다. 예전에는
 * 둘이 서로 다른 줄로 떨어져 있고, 같은 값을 전체 실행 쪽 1~9 드롭다운으로도
 * 고를 수 있어서 같은 것을 두 방식으로 정하게 되어 있었다.
 */
export const buildCheckRows = (
  jobs: readonly JobDefinition[],
  section: 'daily' | 'more' | 'tool',
  targetLabels: ReadonlyMap<string, string>,
): CheckRow[] => {
  const rows: CheckRow[] = [];
  const byTarget = new Map<string, CheckRow>();

  jobs
    .filter((job) => job.section === section)
    .forEach((job) => {
      const targetId = job.targetId;
      if (!targetId) {
        rows.push({ label: job.label, jobs: [job], riskNote: job.riskNote });
        return;
      }
      const existing = byTarget.get(targetId);
      if (existing) {
        existing.jobs.push(job);
        return;
      }
      const row: CheckRow = {
        label: targetLabels.get(targetId) ?? job.label,
        jobs: [job],
        targetId,
        riskNote: job.riskNote,
      };
      byTarget.set(targetId, row);
      rows.push(row);
    });

  return rows;
};
