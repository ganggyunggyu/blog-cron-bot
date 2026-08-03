import * as dotenv from 'dotenv';
import { connectDB, disconnectDB } from './src/database';
import { findMemberByLoginId, updateMemberPreset } from './src/lib/tenant/store';
import { resolveTargetBlogIds } from './src/lib/tenant/preset';
dotenv.config();

const ADDITIONS: Array<{ groupLabel: RegExp; blogId: string; who: string }> = [
  { groupLabel: /서리펫/, blogId: 'higher_0', who: '미마' },
  { groupLabel: /도그마루/, blogId: 'gee0403', who: '하루' },
];

const main = async () => {
  await connectDB(String(process.env.MONGODB_URI));
  const member = await findMemberByLoginId('21lab');
  if (!member) throw new Error('21lab 없음');

  const preset = member.preset;
  console.log('그룹 목록:');
  preset.blogGroups.forEach((g) => console.log(` - ${g.id} | ${g.label} | ${g.blogIds.length}개`));

  let changed = false;
  ADDITIONS.forEach(({ groupLabel, blogId, who }) => {
    const group = preset.blogGroups.find((g) => groupLabel.test(g.label));
    if (!group) { console.log(`X 그룹 못 찾음: ${groupLabel}`); return; }
    if (group.blogIds.includes(blogId)) { console.log(`= 이미 있음: ${who} ${blogId} (${group.label})`); return; }
    group.blogIds.push(blogId);
    changed = true;
    console.log(`+ 추가: ${who} ${blogId} → ${group.label} (${group.blogIds.length}개)`);
  });

  if (changed) await updateMemberPreset(member.id, preset);

  const after = await findMemberByLoginId('21lab');
  ['dogmaru', 'suripet', 'pet', 'package'].forEach((id) => {
    const t = after!.preset.targets.find((x) => x.id === id);
    if (!t) { console.log(`대상 없음: ${id}`); return; }
    const ids = resolveTargetBlogIds(after!.preset, t);
    const marks = ['higher_0', 'gee0403'].filter((b) => ids.includes(b));
    console.log(`${id}: ${ids.length}개${marks.length ? ' | 포함: ' + marks.join(',') : ''}`);
  });
  await disconnectDB();
};
main().catch((e) => { console.error(e); process.exit(1); });
