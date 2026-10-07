import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import { listScripts } from "../../src/deploy/script-tree.mjs";

test("discovers and sorts nested regular files", async () => {
  const entries = new Map([
    [
      "root",
      [
        { name: "nested", isDirectory: () => true, isFile: () => false },
        { name: "z.sh", isDirectory: () => false, isFile: () => true },
      ],
    ],
    ["root/nested", [{ name: "a.sh", isDirectory: () => false, isFile: () => true }]],
  ]);
  const fs = { promises: { readdir: jest.fn(async (directory) => entries.get(directory) || []) } };
  const path = (left, right) => `${left}/${right}`;
  await expect(listScripts(fs, path, "root")).resolves.toEqual(["nested/a.sh", "z.sh"]);
});

test("ignores non-file and non-directory entries", async () => {
  const fs = {
    promises: {
      readdir: jest
        .fn()
        .mockResolvedValue([{ name: "ignored", isDirectory: () => false, isFile: () => false }]),
    },
  };
  await expect(listScripts(fs, () => "", "root")).resolves.toEqual([]);
});

const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);

test("recursively installs the complete scripts tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
  const scripts = join(root, "scripts");
  await mkdir(join(scripts, "commit", "post-hooks.d"), { recursive: true });
  try {
    fsMocks.readdir
      .mockResolvedValueOnce([{ name: "commit", isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: "post-hooks.d", isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: "95-reconcile", isFile: () => true }]);
    fsMocks.stat.mockResolvedValue({ mode: 0o100666 });
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.anything(),
      join(scripts, "commit", "post-hooks.d", "95-reconcile"),
      expect.stringContaining("/.scripts."),
      0o755,
    );
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("install -m 755"))).toBe(
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips an existing empty hook directory", async () => {
  fsMocks.readdir.mockResolvedValue([]);
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(3);
});

test("ignores directory entries that are neither files nor directories", async () => {
  fsMocks.readdir.mockResolvedValue([
    { name: "ignored", isFile: () => false, isDirectory: () => false },
  ]);
  await expect(
    deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot" }),
  ).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(3);
});

test.each([
  ["stderr", "directory setup error", ""],
  ["stdout", "", "directory setup output"],
])(
  "reports nested script upload directory setup failures using %s",
  async (_label, stderr, stdout) => {
    const root = await mkdtemp(join(tmpdir(), "vyops-deploy-"));
    const scripts = join(root, "scripts");
    await mkdir(join(scripts, "commit"), { recursive: true });
    try {
      fsMocks.readdir
        .mockResolvedValueOnce([{ name: "commit", isDirectory: () => true }])
        .mockResolvedValueOnce([{ name: "hook.sh", isFile: () => true }]);
      mocks.exec
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout, stderr })
        .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
      await expect(
        deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
      ).rejects.toThrow(
        `script upload directory setup failed (${join("commit", "hook.sh")}): ${stderr || stdout}`,
      );
      expect(
        mocks.exec.mock.calls.some(
          ([, command]) => command.includes("manifest.tsv") && command.includes("backup"),
        ),
      ).toBe(true);
      expect(
        mocks.exec.mock.calls.some(([, command]) => command.includes("while IFS= read -r name")),
      ).toBe(true);
      expect(
        mocks.exec.mock.calls.some(
          ([, command]) =>
            command.includes("directory") &&
            command.includes("rmdir") &&
            command.includes("sort -r"),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
