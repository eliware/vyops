import { jest } from "@jest/globals";
const { createInterruptionCleanup } =
  await import("../../../src/deploy/remote/interruption-cleanup.mjs");

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

test("reconnects and removes staging when the interrupted client close fails", async () => {
  const recovery = { recovery: true };
  const close = jest.fn().mockRejectedValueOnce(new Error("close failed"));
  const connectClient = jest.fn().mockResolvedValue(recovery);
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const log = { warn: jest.fn() };
  const cleanup = createInterruptionCleanup({
    close,
    connectClient,
    exec,
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    target: "router",
    log,
    getClient: () => ({ active: true }),
  });
  await expect(cleanup()).resolves.toBeUndefined();
  expect(connectClient).toHaveBeenCalledTimes(1);
  expect(exec).toHaveBeenCalledWith(recovery, expect.stringContaining("rm -f --"));
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("interrupted SSH close failed"));
});

test("reports a recovery client close failure", async () => {
  const log = { warn: jest.fn() };
  const cleanup = createInterruptionCleanup({
    close: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("recovery close failed")),
    connectClient: jest.fn().mockResolvedValue({ recovery: true }),
    exec: jest.fn().mockResolvedValue({ code: 0 }),
    remotePaths: {},
    target: "router",
    log,
    getClient: () => ({}),
  });
  await expect(cleanup()).resolves.toBeUndefined();
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("recovery SSH close failed"));
});
