import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import {
  readDeploymentState,
  readManagedPaths,
  unmanagedPaths,
} from "../../src/deploy/script-manifest.mjs";

const header =
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type";
const manifest = (name, preexisting = "false") =>
  `${header}\nfile\t${name}\t${preexisting}\t-\t-\t-\t755\thash\tregular file\n`;

test("reads and validates managed file paths", async () => {
  const readFile = jest.fn().mockResolvedValue(manifest("hook.sh"));
  await expect(readManagedPaths(readFile, "/tmp/manifest")).resolves.toEqual(new Set(["hook.sh"]));
});

test("reads directory records without treating directories as managed files", async () => {
  const content = `${header}\ndirectory\tnested\tfalse\t-\t-\tdirectory\t755\t-\tdirectory\n${manifest("nested/hook.sh").split("\n")[1]}\n`;
  await expect(
    readDeploymentState(jest.fn().mockResolvedValue(content), "/tmp/manifest"),
  ).resolves.toEqual({ managed: new Set(["nested/hook.sh"]), hasManifest: true });
});

test("reports whether a deployment manifest exists", async () => {
  await expect(
    readDeploymentState(jest.fn().mockResolvedValue(manifest("hook.sh")), "/tmp/manifest"),
  ).resolves.toEqual({ managed: new Set(["hook.sh"]), hasManifest: true });
  await expect(
    readDeploymentState(
      jest.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" })),
      "/tmp/manifest",
    ),
  ).resolves.toEqual({ managed: new Set(), hasManifest: false });
});

test("rejects unsafe manifest paths and tolerates a missing manifest", async () => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(manifest("../escape")), "/tmp/manifest"),
  ).rejects.toThrow("unsafe script path");
  await expect(
    readManagedPaths(
      jest.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" })),
      "/tmp/manifest",
    ),
  ).resolves.toEqual(new Set());
});

test.each([
  "file\thook.sh\tfalse\n",
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\thook.sh\tfalse\n",
  `${header}\nfile\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\nfile\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n`,
])("rejects malformed deployment manifests", async (content) => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(content), "/tmp/manifest"),
  ).rejects.toThrow(/invalid header|malformed record|duplicate script path/);
});

test("finds live files absent from the managed manifest", () => {
  expect(
    unmanagedPaths("/config/scripts/hook.sh\0/config/scripts/manual.sh\0", new Set(["hook.sh"])),
  ).toEqual(["manual.sh"]);
});

const { fsMocks, mocks, client, deploy } = await setupDeployHarness(jest);

test("restores a previously managed file through the manifest on failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-rollback-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "managed.sh"), "#!/bin/sh\n");
  await writeFile(`${join(root, "config.boot")}.deployment.tsv`, manifest("managed.sh", "true"));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "managed.sh", isFile: () => true }]);
    mocks.interactive.mockRejectedValue(new Error("deployment failed"));
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("deployment failed");
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("cp -p") && command.includes(".scripts-backup."),
      ),
    ).toBe(true);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("cp -a") && command.includes(".scripts-backup."),
      ),
    ).toBe(true);
    expect(
      mocks.exec.mock.calls.some(([, command]) => command.includes("rm -rf -- /config/scripts")),
    ).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not roll back committed hooks when syncing the config fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    mocks.download.mockRejectedValue(new Error("download failed"));
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("download failed");
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) =>
          command.includes("sudo rm -f") &&
          command.includes("/config/scripts/") &&
          !command.includes(".vyops-"),
      ),
    ).toBe(false);
    expect(
      mocks.exec.mock.calls.some(
        ([, command]) => command.includes("sudo rm -rf") && command.includes(".scripts-backup."),
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installs sorted post-commit hooks and cleans its remote directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "b.sh"), "#!/bin/sh\n");
  await writeFile(join(hooks, "a.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([
      { name: "b.sh", isFile: () => true },
      { name: "a.sh", isFile: () => true },
    ]);
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    expect(mocks.upload.mock.calls.slice(1).map((call) => call[1])).toEqual([
      join(hooks, "a.sh"),
      join(hooks, "b.sh"),
    ]);
    expect(mocks.exec.mock.calls.some((call) => call[1].includes("sudo install"))).toBe(true);
    expect(mocks.exec.mock.calls.some((call) => call[1].includes("sudo chown root:root"))).toBe(
      true,
    );
    expect(mocks.exec.mock.calls.some((call) => call[1].includes("sudo chmod 755"))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses a separate cleanup client and reports hook cleanup failure after reconnect failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const hooks = join(root, "scripts");
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, "hook.sh"), "#!/bin/sh\n");
  const initial = client();
  const interactiveClient = client();
  const cleanupClient = client();
  fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
  mocks.connect
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(interactiveClient)
    .mockRejectedValueOnce(new Error("recovery unavailable"))
    .mockResolvedValueOnce(cleanupClient);
  mocks.interactive.mockRejectedValueOnce(new Error("deployment failed"));
  mocks.exec.mockImplementation(async (_client, command) => {
    if (command.includes("sudo rm -rf --") && command.includes("scripts-backup"))
      throw new Error("hook cleanup failed");
    return { code: 0, stdout: "", stderr: "" };
  });
  try {
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("deployment failed");
    expect(mocks.close).toHaveBeenCalledWith(cleanupClient);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe post-commit hook names", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "../hook.sh", isFile: () => true }]);
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("script path is invalid");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
