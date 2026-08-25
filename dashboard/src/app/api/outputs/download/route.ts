import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { resolveOutputFilePath } from '@/server/output-scanner';

export const GET = async (request: NextRequest) => {
  const relativePath = request.nextUrl.searchParams.get('path');
  // 목록에서 파일을 누르면 이 응답이 브라우저 화면을 통째로 채운다. 영어 원문을 쓰면
  // 사용자는 "not found" 두 단어만 있는 흰 화면을 보게 된다.
  if (!relativePath) {
    return new Response('어떤 파일인지 지정되지 않았음', { status: 400 });
  }

  const resolved = resolveOutputFilePath(relativePath);
  if (!resolved) {
    return new Response('그 파일은 이제 없음. 목록을 새로고침해야 함', {
      status: 404,
    });
  }

  const fileBuffer = fs.readFileSync(resolved);
  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(resolved)}"`,
    },
  });
};
