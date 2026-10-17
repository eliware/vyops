import { promises, resetMemoryFilesystem } from "../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { setupDeployHarness } = await import("../test-fixtures/deploy-harness.mjs");
const { fsMocks, logMock, mocks, deploy } = await setupDeployHarness(jest);
const deploySource = await import("../src/deploy.mjs");

test("deploys config, downloads live state, and logs when debug is enabled", async () => {
  expect(deploySource.deploy).toBe(deploy);
  process.env.VYOPS_DEBUG = "true";
  mocks.interactive.mockImplementation(async (_client, commands, _log, onComplete) => {
    commands.forEach((item) => onComplete?.(typeof item === "string" ? item : item.command));
    return "vyos# compare\n[system]\n+ host-name test\n\nvyos# printf x";
  });
  const config = "/tmp/config.boot";
  const result = await deploy({ target: "testuser@test-router.example.test", config });
  expect(result).toBe(0);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.connect).toHaveBeenCalledWith("testuser@test-router.example.test");
  expect(mocks.upload).toHaveBeenCalledWith(
    expect.anything(),
    config,
    expect.stringMatching(/^\/home\/vyos\/\.config\.deploy\.[0-9a-f-]{36}$/),
  );
  expect(mocks.download).toHaveBeenCalledWith(
    expect.anything(),
    "/config/config.boot",
    expect.stringMatching(/\.config\.boot\.vyops-[0-9a-f-]{36}$/),
  );
});

test("deploys without compare output when debug is disabled", async () => {
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).resolves.toBe(0);
  const commands = mocks.interactive.mock.calls[0][1];
  expect(commands).toEqual(
    expect.arrayContaining([expect.objectContaining({ command: "commit-confirm 5" })]),
  );
  const commandNames = commands.map((item) => (typeof item === "string" ? item : item.command));
  expect(commandNames.indexOf("run set terminal length 0")).toBeLessThan(
    commandNames.indexOf("printf '%s\\n' '--- compare ---'"),
  );
  expect(
    commands
      .find((item) => item.command === "commit-confirm 5")
      .reject.test("WARNING: update-check unable to retrieve data: ConnectionError"),
  ).toBe(false);
  expect(
    commands
      .find((item) => item.command === "commit-confirm 5")
      .reject.test("configuration commit failed"),
  ).toBe(true);
});

test("rejects a completed interactive session without commit confirmation", async () => {
  mocks.interactive.mockResolvedValue("");
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).rejects.toThrow("without confirming the commit");
});

test("marks every deployment phase explicitly", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-deploy-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    const phases = mocks.interactive.mock.calls[0][1]
      .filter((item) => item?.phase)
      .map((item) => item.phase);
    expect(phases).toEqual([
      "load candidate",
      "compare",
      "compare",
      "commit-confirm",
      "confirm",
      "save",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reconnects before opening the interactive deployment shell", async () => {
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).resolves.toBe(0);
  expect(mocks.close).toHaveBeenCalledTimes(3);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.interactive.mock.invocationCallOrder[0]).toBeGreaterThan(
    mocks.close.mock.invocationCallOrder[0],
  );
});

test("passes bootstrap passwords through to SSH without logging them", async () => {
  await expect(
    deploy({ target: "vyos@router", config: "/tmp/config.boot", password: "bootstrap-secret" }),
  ).resolves.toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith("vyos@router", { password: "bootstrap-secret" });
});

test("rejects router failures and always cleans up", async () => {
  mocks.interactive.mockRejectedValue(new Error("interactive command failed: commit-confirm 5"));
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).rejects.toThrow("interactive command failed: commit-confirm 5");
  expect(mocks.exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("rm -f --"));
});

test("propagates download failures and tolerates cleanup failures", async () => {
  mocks.download.mockRejectedValue(new Error("download failed"));
  mocks.exec
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockRejectedValue(new Error("cleanup failed"));
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).rejects.toThrow("download failed");
});

test("reports router-only scripts while preserving them", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-stale-"));
  try {
    await writeFile(join(root, "config.boot"), "system {}\n");
    await writeFile(`${join(root, "config.boot")}.manifest.tsv`, "kind\tpath\nfile\tbundle.sh\n");
    fsMocks.readdir.mockResolvedValue([]);
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes("find -P /config/scripts")
        ? { code: 0, stdout: "/config/scripts/manual.sh\0", stderr: "" }
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /No prior deployment manifest.*matching files.*none.*Router-only files will remain unchanged \(manual\.sh\).*vyops backup <target> <directory>/i,
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports matching scripts that release saves for rollback", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-managed-"));
  try {
    await writeFile(join(root, "config.boot"), "system {}\n");
    await mkdir(join(root, "scripts"));
    await writeFile(join(root, "scripts", "managed.sh"), "#!/bin/sh\n");
    await writeFile(
      `${join(root, "config.boot")}.deployment.tsv`,
      "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\tmanaged.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
    );
    fsMocks.readdir.mockResolvedValue([{ name: "managed.sh", isFile: () => true }]);
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes("find -P /config/scripts")
        ? { code: 0, stdout: "/config/scripts/managed.sh\0", stderr: "" }
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringMatching(/matching files for rollback \(managed\.sh\)/i),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
