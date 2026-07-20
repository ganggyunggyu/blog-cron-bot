import { request, type IncomingMessage } from 'node:http';
import {
  REQUEST_BROKER_TOKEN_ENV,
  REQUEST_BROKER_URL_ENV,
} from './request-broker';

const DEFAULT_ACQUIRE_TIMEOUT_MS = 10 * 60 * 1000;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export interface RequestPermit {
  release: () => Promise<void>;
}

interface RequestPermitOptions {
  acquireTimeoutMs?: number;
}

const resolveBrokerConfiguration = (
  environment: NodeJS.ProcessEnv
): { endpoint: URL; token: string } | null => {
  const rawEndpoint = environment[REQUEST_BROKER_URL_ENV];
  const token = environment[REQUEST_BROKER_TOKEN_ENV];

  if (!rawEndpoint && !token) return null;
  if (!rawEndpoint || !token) {
    throw new Error('요청 허가 브로커 설정이 불완전함');
  }

  const endpoint = new URL('/lease', rawEndpoint);
  if (endpoint.protocol !== 'http:' || !LOOPBACK_HOSTS.has(endpoint.hostname)) {
    throw new Error('요청 허가 브로커는 로컬 HTTP 주소만 허용됨');
  }

  return { endpoint, token };
};

const createRelease = (response: IncomingMessage): (() => Promise<void>) => {
  let releasePromise: Promise<void> | undefined;

  return () => {
    if (releasePromise) return releasePromise;
    releasePromise = new Promise<void>((resolve) => {
      if (response.destroyed) {
        resolve();
        return;
      }

      response.once('close', resolve);
      response.destroy();
    });
    return releasePromise;
  };
};

export const acquireRequestPermit = async (
  environment: NodeJS.ProcessEnv = process.env,
  options: RequestPermitOptions = {}
): Promise<RequestPermit | null> => {
  const configuration = resolveBrokerConfiguration(environment);
  if (!configuration) return null;

  const timeoutMs = options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('요청 허가 대기시간은 0보다 커야 함');
  }

  return new Promise<RequestPermit>((resolve, reject) => {
    let settled = false;
    let response: IncomingMessage | undefined;
    let buffer = '';

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response?.destroy();
      clientRequest.destroy();
      reject(error);
    };

    const timer = setTimeout(() => {
      fail(new Error(`요청 허가 브로커 대기시간 초과 (${timeoutMs}ms)`));
    }, timeoutMs);

    const clientRequest = request(configuration.endpoint, {
      method: 'POST',
      headers: {
        'x-exposure-broker-token': configuration.token,
      },
    });

    clientRequest.once('error', (error) => {
      fail(new Error(`요청 허가 브로커 연결 실패: ${error.message}`));
    });

    clientRequest.once('response', (incoming) => {
      response = incoming;
      if (incoming.statusCode !== 200) {
        incoming.resume();
        fail(
          new Error(
            `요청 허가 브로커 응답 오류: HTTP ${incoming.statusCode ?? 0}`
          )
        );
        return;
      }

      incoming.setEncoding('utf8');
      incoming.on('data', (chunk: string) => {
        if (settled) return;
        buffer += chunk;
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd < 0) return;

        try {
          const parsed = JSON.parse(buffer.slice(0, lineEnd)) as {
            leaseId?: unknown;
          };
          if (typeof parsed.leaseId !== 'string' || parsed.leaseId.length === 0) {
            throw new Error('leaseId 누락');
          }
        } catch (error) {
          fail(
            new Error(
              `요청 허가 브로커 응답 형식 오류: ${(error as Error).message}`
            )
          );
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve({ release: createRelease(incoming) });
      });

      incoming.once('end', () => {
        if (!settled) fail(new Error('요청 허가 브로커 연결이 조기 종료됨'));
      });
      incoming.once('error', (error) => {
        fail(new Error(`요청 허가 브로커 연결 실패: ${error.message}`));
      });
    });

    clientRequest.end();
  });
};

export const withRequestPermit = async <T>(
  operation: () => Promise<T>,
  environment: NodeJS.ProcessEnv = process.env,
  options: RequestPermitOptions = {}
): Promise<T> => {
  const permit = await acquireRequestPermit(environment, options);
  try {
    return await operation();
  } finally {
    await permit?.release();
  }
};
