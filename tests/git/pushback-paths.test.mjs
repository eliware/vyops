import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { pushbackPaths } = await import("../../src/git/pushback-paths.mjs");

test("includes each present manifest as a separate deployment file", async () => {
  const repo = await mkdtemp(join("/virtual", "vyops-pushback-paths-"));
  await writeFile(join(repo, "config.boot.manifest.tsv"), "kind\tpath\n");
  await writeFile(join(repo, "config.boot.deployment.tsv"), "kind\tpath\tstate\n");
  const git = async () => {
    throw new Error("untracked");
  };
  try {
    await expect(pushbackPaths(git, repo, "config.boot")).resolves.toEqual([
      "config.boot",
      "config.boot.manifest.tsv",
      "config.boot.deployment.tsv",
    ]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("includes a tracked manifest and omits absent manifests", async () => {
  const git = async () => {
    return { stdout: "tracked" };
  };
  await expect(pushbackPaths(git, process.cwd(), "missing-config.boot")).resolves.toEqual([
    "missing-config.boot",
    "missing-config.boot.manifest.tsv",
    "missing-config.boot.deployment.tsv",
  ]);
});
