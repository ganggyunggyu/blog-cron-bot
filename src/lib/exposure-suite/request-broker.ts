import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';

export const REQUEST_BROKER_URL_ENV = 'EXPOSURE_REQUEST_BROKER_URL';
export const REQUEST_BROKER_TOKEN_ENV = 'EXPOSURE_REQUEST_BROKER_TOKEN';

interface PendingLease {
  response: ServerResponse;
  granted: boolean;
  closed: boolean;
}

export interface RequestBrokerSnapshot {
  active: number;
  queued: number;
  limit: number;
}

export interface RequestBroker {
  environment: NodeJS.ProcessEnv;
  getSnapshot: () => RequestBrokerSnapshot;
  close: () => Promise<void>;
}

const hasValidToken = (
  candidate: string | string[] | undefined,
  expected: string
): boolean => {
  if (typeof candidate !== 'string') return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
};

export const startRequestBroker = async (
  limit: number
): Promise<RequestBroker> => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('요청 허가 한도는 1 이상의 정수여야 함');
  }

  const token = randomBytes(32).toString('hex');
  const pending: PendingLease[] = [];
  let active = 0;
  let closed = false;

  const drain = (): void => {
    while (!closed && active < limit && pending.length > 0) {
      const lease = pending.shift();
      if (!lease || lease.closed || lease.response.destroyed) continue;

      lease.granted = true;
      active += 1;
      lease.response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      lease.response.write(`${JSON.stringify({ leaseId: randomUUID() })}\n`);
    }
  };

  const server = createServer((request, response) => {
    if (
      request.method !== 'POST' ||
      request.url !== '/lease' ||
      !hasValidToken(request.headers['x-exposure-broker-token'], token)
    ) {
      response.writeHead(401, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end('{"error":"unauthorized"}\n');
      return;
    }

    if (closed) {
      response.writeHead(503, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end('{"error":"broker_closed"}\n');
      return;
    }

    const lease: PendingLease = {
      response,
      granted: false,
      closed: false,
    };
    pending.push(lease);

    response.once('close', () => {
      if (lease.closed) return;
      lease.closed = true;
      if (lease.granted) active -= 1;
      drain();
    });

    drain();
  });

  server.on('clientError', (_error, socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error): void => reject(error);
    server.once('error', handleError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('요청 허가 브로커 주소 확인 실패');
  }

  let closePromise: Promise<void> | undefined;

  return {
    environment: {
      [REQUEST_BROKER_URL_ENV]: `http://127.0.0.1:${address.port}`,
      [REQUEST_BROKER_TOKEN_ENV]: token,
    },
    getSnapshot: () => ({
      active,
      queued: pending.filter((lease) => !lease.closed).length,
      limit,
    }),
    close: () => {
      if (closePromise) return closePromise;

      closed = true;
      pending.splice(0).forEach((lease) => {
        if (!lease.response.destroyed) lease.response.destroy();
      });

      closePromise = new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
        server.closeAllConnections?.();
      });
      return closePromise;
    },
  };
};
