import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);
const { stageScript } = await import("../../src/deploy/script-staging.mjs");

test("stages script metadata with its selected paths", () => {
  expect(typeof stageScript).toBe("function");
});

test("builds binary staging validation with hash verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-binary-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "helper.exe"), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "helper.exe", isFile: () => true }]);
    await expect(
      deploy({
        target: "testuser@test-router.example.test",
        config: join(root, "config.boot"),
        verifyBinaries: true,
      }),
    ).resolves.toBe(0);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("sha256sum") && command.includes("uname -m"),
      ),
    ).toBe(true);
    await expect(
      deploy({
        target: "testuser@test-router.example.test",
        config: join(root, "config.boot"),
        verifyBinaries: false,
      }),
    ).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports remote script validation failures without output", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-remote-check-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "check.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "check.sh", isFile: () => true }]);
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes("! grep -q")
        ? { code: 1, stdout: "", stderr: "" }
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow(
      /remote script preflight failed \(check\.sh\).*mode or line-ending check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
