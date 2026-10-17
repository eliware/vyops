import { jest } from "@jest/globals";
const { cleanupRemoteStaging } = await import("../../../src/deploy/remote/staging-cleanup.mjs");

test("cleans staging and closes an open SSH client", async () => {
  const close = jest.fn();
  const client = { state: "open" };
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await cleanupRemoteStaging({
    exec,
    close,
    connectClient: jest.fn(),
    client,
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    log: { warn: jest.fn() },
    debugLog: jest.fn(),
  });
  expect(exec).toHaveBeenCalledWith(client, expect.stringContaining("rm -f --"));
  expect(close).toHaveBeenCalledWith(client);
});

test("reconnects when the client is closed before cleanup", async () => {
  const close = jest.fn();
  const client = { state: "closed" };
  const recovery = { state: "open" };
  const connectClient = jest.fn().mockResolvedValue(recovery);
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await cleanupRemoteStaging({
    exec,
    close,
    connectClient,
    client,
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    log: { warn: jest.fn() },
    debugLog: jest.fn(),
  });
  expect(close).toHaveBeenNthCalledWith(1, client);
  expect(connectClient).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenNthCalledWith(2, recovery);
});

test("reconnects when close fails for a closed SSH client", async () => {
  const log = { warn: jest.fn() };
  const closedClient = { state: "closed" };
  const recovery = { state: "open" };
  const close = jest.fn().mockRejectedValueOnce(new Error("close denied"));
  const connectClient = jest.fn().mockResolvedValue(recovery);
  await cleanupRemoteStaging({
    exec: jest.fn().mockResolvedValue({ code: 0 }),
    close,
    connectClient,
    client: closedClient,
    remotePaths: {},
    log,
    debugLog: jest.fn(),
  });
  expect(connectClient).toHaveBeenCalledTimes(1);
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("close denied"));
  expect(close).toHaveBeenLastCalledWith(recovery);
});

test("fails when staging cleanup does not complete", async () => {
  const log = { warn: jest.fn() };
  const close = jest.fn();
  const client = {};
  await expect(
    cleanupRemoteStaging({
      exec: jest.fn().mockResolvedValue({ code: 1, stderr: "", stdout: "permission denied" }),
      close,
      connectClient: jest.fn(),
      client,
      remotePaths: {},
      log,
      debugLog: jest.fn(),
    }),
  ).rejects.toThrow(
    "remote staging cleanup failed: remote staging removal failed: permission denied",
  );
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("permission denied"));
  expect(close).toHaveBeenCalledWith(client);
});

test("reports a staging cleanup error when SSH close fails", async () => {
  const log = { warn: jest.fn() };
  await expect(
    cleanupRemoteStaging({
      exec: jest.fn().mockResolvedValue({ code: 0 }),
      close: jest.fn().mockRejectedValue(new Error("close denied")),
      connectClient: jest.fn(),
      client: { state: "open" },
      remotePaths: {},
      log,
      debugLog: jest.fn(),
    }),
  ).rejects.toThrow("remote staging cleanup failed: close denied");
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("close denied"));
});

test("reports cleanup errors without failing a successful operation", async () => {
  const log = { warn: jest.fn() };
  await expect(
    cleanupRemoteStaging({
      exec: jest.fn().mockRejectedValue(new Error("remove denied")),
      close: jest.fn(),
      connectClient: jest.fn(),
      client: { state: "open" },
      remotePaths: {},
      log,
      debugLog: jest.fn(),
      operationSucceeded: true,
    }),
  ).resolves.toBeUndefined();
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("remove denied"));
});

test("preserves the first staging cleanup error when SSH close also fails", async () => {
  const log = { warn: jest.fn() };
  await expect(
    cleanupRemoteStaging({
      exec: jest.fn().mockRejectedValue(new Error("remove denied")),
      close: jest.fn().mockRejectedValue(new Error("close denied")),
      connectClient: jest.fn(),
      client: { state: "open" },
      remotePaths: {},
      log,
      debugLog: jest.fn(),
    }),
  ).rejects.toThrow("remote staging cleanup failed: remove denied");
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("close denied"));
});

test("keeps the release error when staging cleanup also fails", async () => {
  const log = { warn: jest.fn() };
  await expect(
    cleanupRemoteStaging({
      exec: jest.fn().mockRejectedValue(new Error("cleanup failed")),
      close: jest.fn(),
      connectClient: jest.fn(),
      client: {},
      remotePaths: {},
      log,
      debugLog: jest.fn(),
      operationError: new Error("release failed"),
    }),
  ).resolves.toBeUndefined();
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("cleanup failed"));
});

test("keeps the script backup when rollback fails", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await cleanupRemoteStaging({
    exec,
    close: jest.fn(),
    connectClient: jest.fn(),
    client: { state: "open" },
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    log: { warn: jest.fn() },
    debugLog: jest.fn(),
    preserveScriptsBackup: true,
  });
  expect(exec.mock.calls[0][1]).toContain('rm -rf -- "s"');
  expect(exec.mock.calls[0][1]).not.toContain('"b"');
});
