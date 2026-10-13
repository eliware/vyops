import { jest } from "@jest/globals";
import { createInterruptionCleanup } from "../../src/deploy/remote-interruption-cleanup.mjs";

test("closes the interrupted client, reconnects, removes staging, and closes recovery", async () => {
  const close = jest.fn();
  const recovery = { recovery: true };
  const connectClient = jest.fn().mockResolvedValue(recovery);
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const cleanup = createInterruptionCleanup({
    close,
    connectClient,
    exec,
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    target: "router",
    log: { warn: jest.fn() },
    getClient: () => ({ active: true }),
  });
  await cleanup();
  expect(exec).toHaveBeenCalledWith(recovery, expect.stringContaining("rm -f --"));
  expect(close).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenNthCalledWith(2, recovery);
});

test("warns when interruption recovery fails", async () => {
  const log = { warn: jest.fn() };
  const cleanup = createInterruptionCleanup({
    close: jest.fn(),
    connectClient: jest.fn().mockRejectedValue(new Error("reconnect failed")),
    exec: jest.fn(),
    remotePaths: {},
    target: "router",
    log,
    getClient: () => ({}),
  });
  await cleanup();
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("reconnect failed"));
});
