import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import {
  createInterruptionCleanup,
  cleanupRemoteStaging,
} from "../../src/deploy/remote-cleanup.mjs";

test("cleans staging after interruption and closes both clients", async () => {
  const close = jest.fn();
  const connectClient = jest.fn().mockResolvedValue({ recovery: true });
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
  expect(exec).toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(2);
});

test("cleans remote staging and closes the SSH client", async () => {
  const close = jest.fn();
  const client = {};
  await cleanupRemoteStaging({
    exec: jest.fn(),
    close,
    connectClient: jest.fn(),
    client,
    remotePaths: { config: "c", scripts: "s", scriptsBackup: "b" },
    log: { warn: jest.fn() },
    debugLog: jest.fn(),
  });
  expect(close).toHaveBeenCalledWith(client);
});

const { logMock, mocks, client, deploy, cleanupActiveDeployments } = await setupDeployHarness(jest);

test("cleans active deployment staging on interruption", async () => {
  let releaseInteractive;
  mocks.interactive.mockImplementation(
    (_client, _commands, _log, onComplete) =>
      new Promise((resolve) => {
        onComplete?.("confirm");
        releaseInteractive = resolve;
      }),
  );
  const deployment = deploy({
    target: "testuser@test-router.example.test",
    config: "/tmp/config.boot",
  });
  await new Promise((resolve) => setImmediate(resolve));
  mocks.connect.mockRejectedValueOnce(new Error("reconnect unavailable"));
  await cleanupActiveDeployments();
  expect(logMock.warn).toHaveBeenCalledWith(
    expect.stringMatching(/interruption cleanup failed.*reconnect unavailable/i),
  );
  releaseInteractive("");
  await deployment;
});

test("reconnects and removes staging during successful interruption cleanup", async () => {
  let releaseInteractive;
  mocks.interactive.mockImplementation(
    (_client, _commands, _log, onComplete) =>
      new Promise((resolve) => {
        onComplete?.("confirm");
        releaseInteractive = resolve;
      }),
  );
  const deployment = deploy({
    target: "testuser@test-router.example.test",
    config: "/tmp/config.boot",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await cleanupActiveDeployments();
  expect(mocks.connect.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(
    mocks.exec.mock.calls.some(
      ([, command]) => command.includes(".config.deploy.") && command.includes(".scripts-backup."),
    ),
  ).toBe(true);
  releaseInteractive("");
  await deployment;
});

test("reports failed recovery reconnects through debug output", async () => {
  const failure = new Error("deployment transport failed");
  mocks.interactive.mockRejectedValue(failure);
  mocks.connect.mockImplementation(async () => {
    if (mocks.connect.mock.calls.length >= 3) throw new Error("recovery reconnect failed");
    return client();
  });
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).rejects.toBe(failure);
  expect(logMock.debug).toHaveBeenCalledWith(expect.stringMatching(/recovery reconnect failed/));
});

test("discards and reconnects the SSH client after a timeout", async () => {
  const timeout = Object.assign(new Error("interactive SSH timeout"), { code: "VYOPS_TIMEOUT" });
  mocks.interactive.mockRejectedValue(timeout);
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).rejects.toBe(timeout);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.close).toHaveBeenCalledTimes(3);
  expect(
    mocks.exec.mock.calls.some(
      ([, command]) => command.includes(".config.deploy.") && command.includes(".scripts-backup."),
    ),
  ).toBe(true);
});
