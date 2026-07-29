/**
 * 블로그 ID 정규화. 봇 쪽 src/lib/blog-id-overrides의 normalizeBlogId와 같은 규칙이다.
 *
 * 규칙 자체는 @/shared/lib/blog-id 한 곳에만 두고 여기서는 다시 내보낸다.
 * 붙여넣기 화면과 서버 검증이 같은 기준으로 아이디를 잘라야 한다.
 */
export { normalizeBlogId } from '@/shared/lib/blog-id';
