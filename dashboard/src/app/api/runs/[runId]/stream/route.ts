import type { NextRequest } from 'next/server';
import { getRunSnapshot, subscribeToRunLogs } from '@/server/job-runner';

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export const GET = async (request: NextRequest, { params }: RouteParams) => {
  const { runId } = await params;
  const snapshot = getRunSnapshot(runId);

  if (!snapshot) {
    return new Response('run not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      snapshot.logLines.forEach((line) => send('log', line));

      const onLine = (line: string) => send('log', line);
      const onDone = () => {
        const latest = getRunSnapshot(runId);
        send('done', { status: latest?.status ?? 'unknown', exitCode: latest?.exitCode ?? null });
        closeStream();
      };

      const unsubscribe = subscribeToRunLogs(runId, onLine, onDone);

      request.signal.addEventListener('abort', () => {
        unsubscribe?.();
        closeStream();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};
