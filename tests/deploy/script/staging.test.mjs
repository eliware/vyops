import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
import { join } from "node:path";
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
const { setupDeployHarness } = await import("../../../test-fixtures/deploy-harness.mjs");
const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);
const { stageScript } = await import("../../../src/deploy/script/staging.mjs");

test("records script metadata and uploads the staged file", async () => {
  const staged = [];
  fsMocks.stat.mockResolvedValue({ mode: 0o100644 });
  await stageScript({
    name: "hook.sh",
    client: {},
    scriptsDir: "/bundle/scripts",
    remoteDir: "/tmp/scripts",
    installDir: "/config/scripts",
    backupDir: "/tmp/backup",
    manifest: "/tmp/manifest.tsv",
    previouslyManaged: new Set(["hook.sh"]),
    readLocalFile: jest.fn().mockResolvedValue(Buffer.from("#!/bin/sh\n")),
    eliwarePath: (...parts) => parts.join("/"),
    verifyBinaries: false,
    redact: (value) => value,
    staged,
  });
  expect(mocks.upload).toHaveBeenCalledWith(
    expect.any(Object),
    "/bundle/scripts/hook.sh",
    "/tmp/scripts/hook.sh",
    0o755,
  );
  expect(staged).toEqual([
    {
      name: "hook.sh",
      remote: "/tmp/scripts/hook.sh",
      installed: "/config/scripts/hook.sh",
      parent: ".",
      mode: 0o755,
      executable: 0o111,
      binary: false,
      managed: true,
    },
  ]);
});

test("builds binary staging validation with hash verification", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-binary-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "helper.exe"), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "helper.exe", isFile: () => true }]);
    mocks.download.mockImplementation(async (_client, remote, local) => {
      if (remote !== "/config/config.boot")
        await writeFile(
          local,
          "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\n",
        );
    });
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
  const root = await mkdtemp(join("/virtual", "vyops-remote-check-"));
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

test("backs up a preexisting unmanaged script before replacement", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-unmanaged-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "manual.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "manual.sh", isFile: () => true }]);
    mocks.exec.mockImplementation(async (_client, command) =>
      command.includes("find -P /config/scripts")
        ? { code: 0, stdout: "/config/scripts/manual.sh\0", stderr: "" }
        : { code: 0, stdout: "", stderr: "" },
    );
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("cp -p") && command.includes("/config/scripts/manual.sh"),
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
