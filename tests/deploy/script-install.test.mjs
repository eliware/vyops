import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";

test("does not run installation commands for an empty stage", async () => {
  const exec = jest.fn();
  await installStagedScripts({ staged: [], client: {}, exec, debugLog: jest.fn() });
  expect(exec).not.toHaveBeenCalled();
});

const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);
const { installStagedScripts } = await import("../../src/deploy/script-install.mjs");

test("installs shell scripts as executable regardless of local mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(root, "config.boot"), "system {}\n");
  await writeFile(join(scripts, "hook.sh"), "#!/bin/sh\n");
  await writeFile(join(scripts, "helper.exe"), Buffer.from([0, 1, 2]));
  await writeFile(join(scripts, "settings.env"), "KEY=value\n");
  fsMocks.readdir.mockResolvedValue([
    { name: "hook.sh", isFile: () => true },
    { name: "helper.exe", isFile: () => true },
    { name: "settings.env", isFile: () => true },
  ]);
  fsMocks.stat.mockResolvedValue({ mode: 0o100666 });
  try {
    await expect(
      deploy({
        target: "testuser@test-router.example.test",
        config: join(root, "config.boot"),
        hasBinaryScripts: true,
        verifyBinaries: true,
      }),
    ).resolves.toBe(0);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("install -m 755"))).toBe(
      true,
    );
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("install -m 666"))).toBe(
      true,
    );
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("test -x"))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("printf '\\r'"))).toBe(
      true,
    );
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("file -b") && command.includes("uname -m"),
      ),
    ).toBe(true);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("sha256sum") && command.includes("helper.exe"),
      ),
    ).toBe(true);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) =>
          command.includes("file_mode=$(sudo stat") &&
          command.includes("file_hash_output=$(sudo sha256sum") &&
          command.includes("&& printf 'file\\t%s") &&
          command.includes(">> "),
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
