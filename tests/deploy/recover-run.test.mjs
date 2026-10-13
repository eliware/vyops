import { jest } from "@jest/globals";

const recoverDeployment = jest.fn();
await jest.unstable_mockModule("../../src/deploy/recover.mjs", () => ({ recoverDeployment }));
const { recoverRun } = await import("../../src/deploy/recover-run.mjs");

function state() {
  return {
    client: { active: true },
    target: "router",
    close: jest.fn(),
    connectClient: jest.fn(),
    debugLog: jest.fn(),
    setClient: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

test("passes run recovery state to the recovery operation", async () => {
  const current = state();
  const recoveryClient = { recovered: true };
  const error = new Error("release failed");
  const finalizeHooks = jest.fn();
  recoverDeployment.mockResolvedValue(recoveryClient);
  await recoverRun(current, {
    error,
    finalizeHooks,
    hooksFinalized: true,
    deploymentCommitted: true,
  });
  expect(recoverDeployment).toHaveBeenCalledWith({
    error,
    target: "router",
    client: { active: true },
    close: current.close,
    connectClient: current.connectClient,
    debugLog: current.debugLog,
    finalizeHooks,
    hooksFinalized: true,
    deploymentCommitted: true,
  });
  expect(current.client).toBe(recoveryClient);
  expect(current.setClient).toHaveBeenCalledWith(recoveryClient);
});

test("clears the client and logs when recovery fails", async () => {
  const current = state();
  recoverDeployment.mockRejectedValue(new Error("recovery failed"));
  await recoverRun(current, { error: new Error("release failed") });
  expect(current.client).toBeNull();
  expect(current.debugLog).toHaveBeenCalledWith("recovery failed: recovery failed");
  expect(current.setClient).toHaveBeenCalledWith(null);
});
