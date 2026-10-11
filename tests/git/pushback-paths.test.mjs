import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pushbackPaths } from "../../src/git/pushback-paths.mjs";

test("includes each present manifest as a separate deployment file", async () => {
  const repo = await mkdtemp(join(tmpdir(), "vyops-pushback-paths-"));
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
