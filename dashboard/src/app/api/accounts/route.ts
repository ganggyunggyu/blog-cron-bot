import { NextResponse, type NextRequest } from 'next/server';
import {
  addBlogAccount,
  getBlogAccountLists,
  isManagedListId,
  removeBlogAccount,
} from '@/server/blog-accounts';

const toErrorResponse = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  console.error('계정 관리 처리 중 오류', error);
  return NextResponse.json({ error: message }, { status: 500 });
};

export const GET = async () => {
  try {
    return NextResponse.json({ lists: await getBlogAccountLists() });
  } catch (error) {
    return toErrorResponse(error, '계정 목록을 불러오지 못함');
  }
};

export const POST = async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바른 JSON이 아님' },
      { status: 400 },
    );
  }

  const { listId, blogId, action } = (body ?? {}) as {
    listId?: unknown;
    blogId?: unknown;
    action?: unknown;
  };

  if (!isManagedListId(listId)) {
    return NextResponse.json(
      { error: '관리 대상이 아닌 목록임' },
      { status: 400 },
    );
  }
  if (typeof blogId !== 'string' || blogId.trim().length === 0) {
    return NextResponse.json({ error: '블로그 ID가 비어 있음' }, { status: 400 });
  }
  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: '지원하지 않는 작업임' }, { status: 400 });
  }

  try {
    const lists =
      action === 'add'
        ? await addBlogAccount(listId, blogId)
        : await removeBlogAccount(listId, blogId);
    return NextResponse.json({ lists });
  } catch (error) {
    const message = error instanceof Error ? error.message : '계정 변경 실패';
    if (message.includes('형식이 올바르지 않음')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return toErrorResponse(error, '계정 변경 실패');
  }
};
