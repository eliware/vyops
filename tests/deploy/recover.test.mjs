import { jest } from "@jest/globals";
import { recoverDeployment } from "../../src/deploy/recover.mjs";

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
