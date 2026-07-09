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

export const createSessionToken = async () => {
  const issuedAt = Date.now().toString();
  const key = await getSecretKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(issuedAt));
  return `${issuedAt}.${bufferToBase64Url(signature)}`;
};

export const verifySessionToken = async (token: string | undefined | null) => {
  if (!token) return false;

  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;

  const key = await getSecretKey();
  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(issuedAt));
  const expectedBase64Url = bufferToBase64Url(expectedSignature);
  if (expectedBase64Url !== signature) return false;

  const age = Date.now() - Number(issuedAt);
  const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
  return age >= 0 && age <= maxAgeMs;
};

export const verifyPassword = (candidate: string) => {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    throw new Error('DASHBOARD_PASSWORD is not set');
  }
  return candidate === expected;
};
