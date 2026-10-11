import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
test("returns an empty managed path set when no manifest exists", async () => {
  const { inspectLiveScripts } = await import("../../src/deploy/inspect-live-scripts.mjs");
  const result = await inspectLiveScripts({}, "missing-config");
  expect(result).toEqual(new Set());
});

const { fsMocks, logMock, mocks, deploy } = await setupDeployHarness(jest);

test("reports bundle matches and router-only scripts without a deployment manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-stale-"));
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

test("reports matching files that VyOps saves for rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-managed-"));
  try {
    await writeFile(join(root, "config.boot"), "system {}\n");
    await writeFile(`${join(root, "config.boot")}.deployment.tsv`, "file\tmanaged.sh\n");
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
