import { cleanupActiveDeployments, registerDeploymentCleanup } from '../../src/deploy/cleanup.mjs';
import { jest } from '@jest/globals';

test('runs registered deployment cleanups and unregisters them', async () => {
  const cleanup = jest.fn();
  const unregister = registerDeploymentCleanup(cleanup);
  await cleanupActiveDeployments();
  expect(cleanup).toHaveBeenCalledTimes(1);
  unregister();
  await cleanupActiveDeployments();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
