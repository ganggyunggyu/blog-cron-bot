import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { resolveOutputFilePath } from '@/server/output-scanner';

export const GET = async (request: NextRequest) => {
  const relativePath = request.nextUrl.searchParams.get('path');
  if (!relativePath) {
    return new Response('path required', { status: 400 });
  }

  const resolved = resolveOutputFilePath(relativePath);
  if (!resolved) {
    return new Response('not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(resolved);
  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(resolved)}"`,
    },
  });
};
