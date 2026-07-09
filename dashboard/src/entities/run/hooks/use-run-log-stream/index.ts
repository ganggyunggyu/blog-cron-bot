'use client';

import React from 'react';

interface RunDonePayload {
  status: string;
  exitCode: number | null;
}

export const useRunLogStream = (runId: string | null) => {
  const [trackedRunId, setTrackedRunId] = React.useState(runId);
  const [lines, setLines] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [exitCode, setExitCode] = React.useState<number | null>(null);

  if (runId !== trackedRunId) {
    setTrackedRunId(runId);
    setLines([]);
    setStatus(null);
    setExitCode(null);
  }

  React.useEffect(() => {
    if (!runId) return undefined;

    const source = new EventSource(`/api/runs/${runId}/stream`);

    const handleLog = (event: MessageEvent<string>) => {
      const line = JSON.parse(event.data) as string;
      setLines((prev) => [...prev, line]);
    };

    const handleDone = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as RunDonePayload;
      setStatus(payload.status);
      setExitCode(payload.exitCode);
      source.close();
    };

    source.addEventListener('log', handleLog);
    source.addEventListener('done', handleDone);

    return () => {
      source.removeEventListener('log', handleLog);
      source.removeEventListener('done', handleDone);
      source.close();
    };
  }, [runId]);

  return { lines, status, exitCode };
};
