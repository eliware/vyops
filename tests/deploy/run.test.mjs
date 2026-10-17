import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
jest.useFakeTimers();
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { runDeployment } = await import("../../src/deploy/run.mjs");
const { setupDeployHarness } = await import("../../test-fixtures/deploy-harness.mjs");

test("prepares, recovers, and cleans up when release commands fail", async () => {
  const events = [];
  const client = { state: "open" };
  const options = {
    remotePaths: { config: "/tmp/config", scripts: "/tmp/scripts", scriptsBackup: "/tmp/backup" },
    client,
    target: "vyos@test-router",
    config: "config.boot",
    runId: "run",
    verifyBinaries: false,
    hasHaproxyHooks: false,
    hasBinaryScripts: false,
    noHooks: false,
    redact: (value) => value,
    phase: (name) => events.push(name),
    debugLog: () => {},
    log: { info: jest.fn(), warn: jest.fn() },
    exec: async () => ({ code: 0, stdout: "", stderr: "" }),
    upload: async () => events.push("upload"),
    remotePreflight: async () => events.push("preflight"),
    installScripts: async () => null,
    close: async () => events.push("close"),
    connectClient: async () => {
      events.push("connect");
      return client;
    },
    setClient: () => {},
    interactive: async () => {
      events.push("interactive");
      throw new Error("release command failed");
    },
    unregisterCleanup: () => events.push("unregister"),
  };
  await expect(runDeployment(options)).rejects.toThrow("release command failed");
  expect(events).toEqual([
    "remote preflight",
    "preflight",
    "upload config",
    "upload",
    "upload scripts",
    "connect",
    "close",
    "connect",
    "interactive",
    "close",
    "connect",
    "unregister",
    "close",
  ]);
});

const { fsMocks, logMock, mocks, client, deploy, cleanupActiveDeployments } =
  await setupDeployHarness(jest);

async function pauseDeploymentAtConfirmation() {
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
  await jest.advanceTimersByTimeAsync(0);
  return { deployment, releaseInteractive: (value) => releaseInteractive(value) };
}

test("cleans active deployment staging on interruption", async () => {
  const { deployment, releaseInteractive } = await pauseDeploymentAtConfirmation();
  mocks.connect.mockRejectedValueOnce(new Error("reconnect unavailable"));
  await cleanupActiveDeployments();
  expect(logMock.warn).toHaveBeenCalledWith(
    expect.stringMatching(/interruption cleanup failed.*reconnect unavailable/i),
  );
  releaseInteractive("");
  await deployment;
});

test("reconnects and removes staging during successful interruption cleanup", async () => {
  const { deployment, releaseInteractive } = await pauseDeploymentAtConfirmation();
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

test("returns success when confirmed release staging cleanup fails", async () => {
  mocks.exec.mockImplementation(async (_client, command) =>
    command.startsWith("rm -f --")
      ? { code: 1, stdout: "", stderr: "permission denied" }
      : { code: 0, stdout: "", stderr: "" },
  );
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).resolves.toBe(0);
  expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining("permission denied"));
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

test("keeps the deployment error when hook recovery also fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-recovery-"));
  const scripts = join(root, "scripts");
  const failure = new Error("deployment command failed");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "hook.sh"), "#!/bin/sh\n");
  fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
  mocks.interactive.mockRejectedValue(failure);
  mocks.connect.mockImplementation(async () => {
    if (mocks.connect.mock.calls.length >= 3) throw new Error("recovery unavailable");
    return client();
  });
  try {
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toBe(failure);
    expect(logMock.debug).toHaveBeenCalledWith(
      expect.stringMatching(/recovery failed.*unavailable/),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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

test("tolerates hook rollback cleanup failures", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    mocks.interactive.mockRejectedValue(new Error("deployment failed"));
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes('$3 == "false"')
        ? Promise.reject(new Error("rollback cleanup failed"))
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("deployment failed");
    expect(mocks.exec).toHaveBeenCalledTimes(9);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
