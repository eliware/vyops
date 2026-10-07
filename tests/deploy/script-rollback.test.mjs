import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import { finalizeScripts, rollbackScripts } from "../../src/deploy/script-rollback.mjs";

test("rolls back managed script paths and warns on failure", async () => {
  const exec = jest.fn().mockRejectedValue(new Error("transport lost"));
  const log = { warn: jest.fn() };
  await rollbackScripts(exec, log, {
    client: {},
    manifest: "/tmp/m.tsv",
    installDir: "/config/scripts",
    backupDir: "/tmp/b",
    remoteDir: "/tmp/r",
  });
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("script rollback failed"));
});

test("removes staging only after committed deployment", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await finalizeScripts(
    exec,
    { warn: jest.fn() },
    { client: {}, committed: true, backupDir: "/tmp/b", remoteDir: "/tmp/r" },
  );
  expect(exec.mock.calls[0][1]).toContain("rm -rf");
});

const { fsMocks, logMock, mocks, deploy } = await setupDeployHarness(jest);

test("hook setup and install failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "setup out", stderr: "" });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script directory setup failed: setup out");
    mocks.exec.mockReset();
    fsMocks.readdir.mockResolvedValueOnce([{ name: "hook.sh", isFile: () => true }]);
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "install err" })
      .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script install failed (hook.sh): install err");
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("manifest.tsv") && command.includes("backup"),
      ),
    ).toBe(true);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("while IFS= read -r name") && command.includes("false"),
      ),
    ).toBe(true);
    mocks.exec.mockReset();
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "install out", stderr: "" })
      .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    fsMocks.readdir.mockResolvedValueOnce([{ name: "hook.sh", isFile: () => true }]);
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script install failed (hook.sh): install out");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("handles non-missing hook directory errors and hook cleanup errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockRejectedValueOnce(new Error("permission denied"));
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("permission denied");
    fsMocks.readdir.mockResolvedValueOnce([{ name: "hook.sh", isFile: () => true }]);
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes("sudo rm -rf") && command.includes("scripts-backup")
        ? Promise.reject(new Error("hook cleanup failed"))
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("tolerates hook rollback cleanup failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
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

test("reports hook backup failures and tolerates install rollback failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "backup err" })
      .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script backup failed (hook.sh): backup err");

    mocks.exec.mockReset();
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "backup out", stderr: "" })
      .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script backup failed (hook.sh): backup out");

    mocks.exec.mockReset();
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "install out", stderr: "" })
      .mockRejectedValueOnce(new Error("install rollback failed"))
      .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script install failed (hook.sh): install out");
    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(/cleanup warning: script rollback failed: install rollback failed/i),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
