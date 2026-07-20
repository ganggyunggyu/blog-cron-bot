export const waitForAllOrThrow = async <T>(
  promises: Promise<T>[]
): Promise<T[]> => {
  const settled = await Promise.allSettled(promises);
  const firstFailure = settled.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (firstFailure) throw firstFailure.reason;

  return settled.map((result) => (result as PromiseFulfilledResult<T>).value);
};
