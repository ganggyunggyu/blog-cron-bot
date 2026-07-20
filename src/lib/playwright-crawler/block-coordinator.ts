export type BlockRecoveryRole = 'leader' | 'follower';

let recoveryPromise: Promise<void> | null = null;

export const coordinateBlockRecovery = async (
  recover: () => Promise<void>,
  refreshAfterSharedRecovery: () => Promise<void>
): Promise<BlockRecoveryRole> => {
  const activeRecovery = recoveryPromise;
  if (activeRecovery) {
    await activeRecovery;
    await refreshAfterSharedRecovery();
    return 'follower';
  }

  const nextRecovery = Promise.resolve().then(recover);
  recoveryPromise = nextRecovery;

  try {
    await nextRecovery;
    return 'leader';
  } finally {
    if (recoveryPromise === nextRecovery) {
      recoveryPromise = null;
    }
  }
};
