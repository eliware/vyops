import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
import { join } from "node:path";
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
const { setupDeployHarness } = await import("../../test-fixtures/deploy-harness.mjs");
test("returns an empty managed path set when no manifest exists", async () => {
  const { inspectLiveScripts } = await import("../../src/deploy/inspect-live-scripts.mjs");
  const result = await inspectLiveScripts({}, "missing-config");
  expect(result).toEqual(new Set());
});

const { fsMocks, logMock, mocks, deploy } = await setupDeployHarness(jest);
const { inspectLiveScripts } = await import("../../src/deploy/inspect-live-scripts.mjs");

test.each([
  ["stderr", "permission denied", "", "permission denied"],
  ["stdout", "", "inspection output", "inspection output"],
  ["empty output", "", "", "live script inspection failed"],
])("reports live script scan failures from %s", async (_label, stderr, stdout, message) => {
  const root = await mkdtemp(join("/virtual", "vyops-inspection-"));
  const config = join(root, "config.boot");
  await writeFile(
    `${config}.deployment.tsv`,
    "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\tmanaged.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
  );
  mocks.exec.mockResolvedValueOnce({ code: 1, stderr, stdout });
  try {
    await expect(inspectLiveScripts({}, config)).rejects.toThrow(
      `live script inspection failed: ${message}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects symbolic links in the live script tree", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-inspection-"));
  const config = join(root, "config.boot");
  await writeFile(
    `${config}.deployment.tsv`,
    "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\n",
  );
  mocks.exec.mockResolvedValueOnce({
    code: 0,
    stdout: "VYOPS_SYMLINK\0/config/scripts/linked-hook\0",
    stderr: "",
  });
  try {
    await expect(inspectLiveScripts({}, config)).rejects.toThrow(
      "symbolic link found in live script tree",
    );
    expect(mocks.exec).toHaveBeenCalledTimes(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
