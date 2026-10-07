import { jest } from "@jest/globals";
import { completeDeployment } from "../../src/deploy/complete.mjs";

test("downloads the confirmed config and finalizes hooks", async () => {
  let client = {};
  const download = jest.fn();
  const finalizeHooks = jest.fn();
  await completeDeployment({
    getClient: () => client,
    setClient: (value) => {
      client = value;
    },
    connectClient: async () => ({ next: true }),
    close: async () => {},
    download,
    manifest: "manifest",
    config: "config",
    finalizeHooks,
    verify: false,
    exec: async () => {},
    log: { info: jest.fn() },
    redact: (value) => value,
    phase: () => {},
    debugLog: () => {},
    setHooksFinalized: jest.fn(),
  });
  expect(download).toHaveBeenCalledTimes(2);
  expect(finalizeHooks).toHaveBeenCalledWith(true, client);
});
