import { isIP } from 'node:net';

const EGRESS_IP_ENDPOINT = 'https://api.ipify.org?format=json';
let cachedEgressIp: Promise<string> | undefined;

export const parseEgressIpResponse = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('외부 IP 응답 형식이 올바르지 않음');
  }

  const ip = String(Reflect.get(payload, 'ip') ?? '').trim();
  if (isIP(ip) === 0) throw new Error(`유효하지 않은 외부 IP 응답: ${ip}`);
  return ip;
};

export const getWorkerEgressIp = (): Promise<string> => {
  cachedEgressIp ??= fetch(EGRESS_IP_ENDPOINT, {
    signal: AbortSignal.timeout(5_000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`외부 IP 확인 HTTP ${response.status}`);
      return parseEgressIpResponse(await response.json());
    })
    .catch((error: unknown) => {
      cachedEgressIp = undefined;
      throw error;
    });

  return cachedEgressIp;
};
