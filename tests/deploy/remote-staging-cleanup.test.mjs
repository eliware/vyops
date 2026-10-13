import { jest } from "@jest/globals";
import { cleanupRemoteStaging } from "../../src/deploy/remote-staging-cleanup.mjs";

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

test("warns when staging cleanup fails", async () => {
  const log = { warn: jest.fn() };
  const close = jest.fn();
  const client = {};
  await cleanupRemoteStaging({
    exec: jest.fn().mockRejectedValue(new Error("transport lost")),
    close,
    connectClient: jest.fn(),
    client,
    remotePaths: {},
    log,
    debugLog: jest.fn(),
  });
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("transport lost"));
  expect(close).toHaveBeenCalledWith(client);
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
