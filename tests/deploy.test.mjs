import { jest } from "@jest/globals";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupDeployHarness } from "../test-fixtures/deploy-harness.mjs";
const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);
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
  expect(mocks.download).toHaveBeenCalledWith(expect.anything(), "/config/config.boot", config);
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
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
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
