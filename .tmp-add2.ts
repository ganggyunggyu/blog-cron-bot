import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from './src/database';
import { findMemberByLoginId, updateMemberPreset } from './src/lib/tenant/store';
import { resolveTargetBlogIds } from './src/lib/tenant/preset';
dotenv.config();

const ADD: Array<{ group: RegExp; blogId: string; who: string }> = [
  { group: /도그마루/, blogId: 'sajapyung', who: '옳아(듬지)' },
  { group: /^일반 계정$/, blogId: 'potenpop', who: '뷰티인' },
  { group: /^일반 계정$/, blogId: 'hoooooy', who: 'NBA' },
];

const main = async () => {
  await connectDB(String(process.env.MONGODB_URI));
  const member = await findMemberByLoginId('21lab');
  if (!member) throw new Error('21lab 없음');
  const preset = member.preset;

  let changed = false;
  ADD.forEach(({ group, blogId, who }) => {
    const g = preset.blogGroups.find((x) => group.test(x.label));
    if (!g) { console.log(`X 그룹 못 찾음: ${group}`); return; }
    if (g.blogIds.includes(blogId)) { console.log(`= 이미 있음: ${who} ${blogId}`); return; }
    g.blogIds.push(blogId);
    changed = true;
    console.log(`+ ${who}: ${blogId} → ${g.label} (${g.blogIds.length}개)`);
  });
  if (changed) await updateMemberPreset(member.id, preset);

  const after = await findMemberByLoginId('21lab');
  console.log('\n대상별 최종 계정 수:');
  ['package', 'general', 'root', 'dogmaru', 'suripet', 'pet'].forEach((id) => {
    const t = after!.preset.targets.find((x) => x.id === id);
    if (!t) return;
    const ids = resolveTargetBlogIds(after!.preset, t);
    const marks = ['kmy8609', 'mima', 'higher_0', 'gee0403', 'sajapyung', 'potenpop', 'hoooooy'].filter((b) => ids.includes(b));
    console.log(`  ${id.padEnd(9)} ${String(ids.length).padStart(4)}개${marks.length ? ' | ' + marks.join(', ') : ''}`);
  });
  await disconnectDB();
};
main().catch((e) => { console.error(e); process.exit(1); });
