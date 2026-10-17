import { jest } from "@jest/globals";
const { cleanupActiveDeployments, registerDeploymentCleanup } =
  await import("../../src/deploy/cleanup.mjs");

test("runs registered deployment cleanups and unregisters them", async () => {
  const cleanup = jest.fn();
  const unregister = registerDeploymentCleanup(cleanup);
  await cleanupActiveDeployments();
  expect(cleanup).toHaveBeenCalledTimes(1);
  unregister();
  await cleanupActiveDeployments();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
