import { pushbackPaths } from "../../src/git/pushback-paths.mjs";

test("includes the config and a present manifest", async () => {
  const git = async () => ({ stdout: "" });
  await expect(pushbackPaths(git, process.cwd(), "config.boot")).resolves.toEqual([
    "config.boot",
    "config.boot.manifest.tsv",
  ]);
});

test("omits a manifest when no file or tracked record exists", async () => {
  const git = async () => {
    throw new Error("untracked");
  };
  await expect(pushbackPaths(git, process.cwd(), "missing-config.boot")).resolves.toEqual([
    "missing-config.boot",
  ]);
});
