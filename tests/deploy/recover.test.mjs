import { jest } from "@jest/globals";
const { recoverDeployment } = await import("../../src/deploy/recover.mjs");

test("reconnects and finalizes hooks during recovery", async () => {
  const client = {};
  const close = jest.fn();
  const connectClient = jest.fn().mockResolvedValue(client);
  const finalizeHooks = jest.fn();
  await recoverDeployment({
    error: new Error("failed"),
    target: "router",
    client: {},
    close,
    connectClient,
    debugLog: jest.fn(),
    finalizeHooks,
    hooksFinalized: false,
    deploymentCommitted: false,
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(finalizeHooks).toHaveBeenCalledWith(false, client);
});

test("keeps confirmed hooks after local synchronization fails", async () => {
  const client = { recovery: true };
  const close = jest.fn();
  const finalizeHooks = jest.fn();
  const recoveryClient = await recoverDeployment({
    error: new Error("local config download failed"),
    target: "router",
    client: {},
    close,
    connectClient: jest.fn().mockResolvedValue(client),
    debugLog: jest.fn(),
    finalizeHooks,
    hooksFinalized: false,
    deploymentCommitted: true,
  });
  expect(recoveryClient).toBe(client);
  expect(close).toHaveBeenCalledTimes(1);
  expect(finalizeHooks).toHaveBeenCalledWith(true, client);
});

test("marks the script backup for retention when hook rollback fails", async () => {
  const error = new Error("release failed");
  await recoverDeployment({
    error,
    target: "router",
    client: {},
    close: jest.fn(),
    connectClient: jest.fn().mockResolvedValue({}),
    debugLog: jest.fn(),
    finalizeHooks: jest.fn().mockResolvedValue(false),
    hooksFinalized: false,
    deploymentCommitted: false,
  });
  expect(error.preserveScriptsBackup).toBe(true);
});
