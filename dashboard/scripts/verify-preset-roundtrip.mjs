/**
 * 프리셋 저장 경로가 실제 DB에서 왕복하는지 확인한다.
 *
 * 대시보드 라우트가 쓰는 것과 같은 모듈(preset 검증 + member-auth 저장)을 그대로 태워서,
 * 화면 없이도 "읽기 → 검증 → 저장 → 다시 읽기"가 값을 안 망가뜨리는지 본다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dashboardDirectory = path.resolve(scriptDirectory, '..');
const projectDirectory = path.resolve(dashboardDirectory, '..');
const rootEnvironment = parse(readFileSync(path.join(projectDirectory, '.env')));
process.env.MONGODB_URI ||= rootEnvironment.MONGODB_URI;

const { parsePreset } = await import('../src/server/preset.ts');
const { findMemberAccountById, saveMemberPreset } = await import(
  '../src/server/member-auth.ts'
);
const mongoose = (await import('mongoose')).default;

const memberId = process.argv[2] ?? '21lab';

const before = await findMemberAccountById(memberId);
if (!before) throw new Error(`회원 ${memberId}을 찾지 못함`);
console.log(`before: 대상 ${before.preset.targets.length}개`);

const parsed = parsePreset(before.preset);
console.log(`parsed: 대상 ${parsed.targets.length}개`);

const after = await saveMemberPreset(memberId, parsed);
if (!after) throw new Error('저장 후 회원을 찾지 못함');
console.log(`after: 대상 ${after.preset.targets.length}개`);

const isSame =
  JSON.stringify(after.preset) === JSON.stringify(parsed) &&
  after.preset.targets.length === before.preset.targets.length;
console.log(`roundtrip identical: ${isSame}`);

const { resolveTargetBlogIds } = await import('../src/server/preset.ts');

console.log(`계정 그룹 ${after.preset.blogGroups.length}개`);
after.preset.blogGroups.forEach(({ id, label, blogIds }) => {
  console.log(`  ${label} (${id}): 계정 ${blogIds.length}개`);
});

after.preset.targets.forEach((target) => {
  const { label, kind, source, result, maxPages, blogGroupIds } = target;
  const write = result ? result.tabTitle : '원본 시트에 반영';
  const pages = maxPages ? ` ${maxPages}p` : '';
  const groups = blogGroupIds?.length ? blogGroupIds.join('+') : '전체';
  const accounts = resolveTargetBlogIds(after.preset, target).length;
  console.log(
    `  [${kind}${pages}] ${label}: ${source.tabTitle} → ${write} · 계정 ${groups} ${accounts}개`,
  );
});

await mongoose.disconnect();
process.exitCode = isSame ? 0 : 1;
