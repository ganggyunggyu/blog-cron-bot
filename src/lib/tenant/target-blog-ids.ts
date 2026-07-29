import type { MemberSummary } from './store';
import { resolveTargetBlogIds } from './preset';

export interface TargetBlogIdSelection {
  blogIds: string[];
  source: 'preset' | 'fallback';
}

export const selectTargetBlogIds = (
  member: MemberSummary | null,
  targetId: string,
  fallbackBlogIds: readonly string[]
): TargetBlogIdSelection => {
  const target = member?.preset.targets.find(({ id }) => id === targetId);
  if (!member || !target) {
    return { blogIds: [...fallbackBlogIds], source: 'fallback' };
  }

  const blogIds = resolveTargetBlogIds(member.preset, target);
  if (blogIds.length === 0) {
    return { blogIds: [...fallbackBlogIds], source: 'fallback' };
  }

  return { blogIds, source: 'preset' };
};
