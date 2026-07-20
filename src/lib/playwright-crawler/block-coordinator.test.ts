import assert from 'node:assert/strict';
import { coordinateBlockRecovery } from './block-coordinator';

const runConcurrentRecoveryTest = async (): Promise<void> => {
  let releaseRecovery: (() => void) | undefined;
  const recoveryGate = new Promise<void>((resolve) => {
    releaseRecovery = resolve;
  });
  let recoveryCount = 0;
  let followerRefreshCount = 0;

  const leader = coordinateBlockRecovery(
    async () => {
      recoveryCount += 1;
      await recoveryGate;
    },
    async () => {
      throw new Error('leader must not run follower refresh');
    }
  );
  const follower = coordinateBlockRecovery(
    async () => {
      recoveryCount += 1;
    },
    async () => {
      followerRefreshCount += 1;
    }
  );

  await Promise.resolve();
  assert.equal(recoveryCount, 1);
  assert.equal(followerRefreshCount, 0);

  releaseRecovery?.();
  assert.equal(await leader, 'leader');
  assert.equal(await follower, 'follower');
  assert.equal(recoveryCount, 1);
  assert.equal(followerRefreshCount, 1);
};

const runFailureResetTest = async (): Promise<void> => {
  const expectedError = new Error('recovery failed');
  await assert.rejects(
    coordinateBlockRecovery(
      async () => {
        throw expectedError;
      },
      async () => {}
    ),
    expectedError
  );

  let recoveryCount = 0;
  const role = await coordinateBlockRecovery(
    async () => {
      recoveryCount += 1;
    },
    async () => {}
  );

  assert.equal(role, 'leader');
  assert.equal(recoveryCount, 1);
};

const main = async (): Promise<void> => {
  await runConcurrentRecoveryTest();
  await runFailureResetTest();
  process.stdout.write('block coordinator tests passed\n');
};

void main();
