'use client';

import React from 'react';
import type { RunStatus } from '../../model';

interface RunDonePayload {
  status: RunStatus;
  exitCode: number | null;
}

export type RunLogConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
const MAX_CONNECTION_ERRORS = 3;

interface RunLogStreamState {
  runId: string | null;
  lines: string[];
  status: RunStatus | null;
  exitCode: number | null;
  connectionState: RunLogConnectionState;
}

const createInitialState = (runId: string | null): RunLogStreamState => ({
  runId,
  lines: [],
  status: null,
  exitCode: null,
  connectionState: runId ? 'connecting' : 'idle',
});

export const useRunLogStream = (runId: string | null) => {
  const [state, setState] = React.useState<RunLogStreamState>(() => createInitialState(runId));
  const currentState = state.runId === runId ? state : createInitialState(runId);

  React.useEffect(() => {
    if (!runId) return undefined;

    const source = new EventSource(`/api/runs/${runId}/stream`);
    let connectionErrors = 0;

    const handleOpen = () => {
      connectionErrors = 0;
      setState({ ...createInitialState(runId), connectionState: 'open' });
    };

    const handleLog = (event: MessageEvent<string>) => {
      const line = JSON.parse(event.data) as string;
      setState((current) => {
        const next = current.runId === runId ? current : createInitialState(runId);
        return { ...next, lines: [...next.lines, line], connectionState: 'open' };
      });
    };

    const handleDone = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as RunDonePayload;
      setState((current) => ({
        ...(current.runId === runId ? current : createInitialState(runId)),
        status: payload.status,
        exitCode: payload.exitCode,
        connectionState: 'closed',
      }));
      source.close();
    };

    const handleError = () => {
      connectionErrors += 1;
      const hasGivenUp = connectionErrors >= MAX_CONNECTION_ERRORS;
      setState((current) => {
        const next = current.runId === runId ? current : createInitialState(runId);
        return {
          ...next,
          status: hasGivenUp ? 'unknown' : next.status,
          connectionState: hasGivenUp ? 'closed' : 'reconnecting',
        };
      });
      if (hasGivenUp) source.close();
    };

    source.addEventListener('open', handleOpen);
    source.addEventListener('log', handleLog);
    source.addEventListener('done', handleDone);
    source.addEventListener('error', handleError);

    return () => {
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('log', handleLog);
      source.removeEventListener('done', handleDone);
      source.removeEventListener('error', handleError);
      source.close();
    };
  }, [runId]);

  return currentState;
};
