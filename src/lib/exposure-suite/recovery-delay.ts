import { setTimeout as delay } from 'node:timers/promises';

export const waitForRecoveryDelay = async (
  delayMs: number,
  signal: AbortSignal
): Promise<void> => {
  if (signal.aborted) return;

  try {
    await delay(delayMs, undefined, { signal });
  } catch (error) {
    if (signal.aborted && (error as Error).name === 'AbortError') return;
    throw error;
  }
};
