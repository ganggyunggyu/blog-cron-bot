const encoder = new TextEncoder();

export const SESSION_COOKIE_NAME = 'dashboard_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const bufferToBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const getSecretKey = async () => {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) {
    throw new Error('DASHBOARD_SESSION_SECRET is not set');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
};

export interface SessionPayload {
  memberId: string;
  issuedAt: number;
}

/**
 * 세션에 누구인지를 담는다.
 *
 * 예전 토큰은 발급 시각만 서명해서 "로그인했다"는 사실만 알 수 있었고, 어느 계정인지
 * 알 수 없어 계정별 프리셋을 쓸 수 없었다. memberId를 함께 서명한다.
 */
export const createSessionToken = async (memberId: string) => {
  const issuedAt = Date.now().toString();
  const payload = `${issuedAt}.${memberId}`;
  const key = await getSecretKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${bufferToBase64Url(signature)}`;
};

export const readSessionToken = async (
  token: string | undefined | null,
): Promise<SessionPayload | null> => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [issuedAtRaw, memberId, signature] = parts;
  if (!issuedAtRaw || !memberId || !signature) return null;

  const key = await getSecretKey();
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${issuedAtRaw}.${memberId}`),
  );
  if (bufferToBase64Url(expected) !== signature) return null;

  const issuedAt = Number(issuedAtRaw);
  const age = Date.now() - issuedAt;
  if (!Number.isFinite(issuedAt) || age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) {
    return null;
  }

  return { memberId, issuedAt };
};

export const verifySessionToken = async (token: string | undefined | null) =>
  (await readSessionToken(token)) !== null;
