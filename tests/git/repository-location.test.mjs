import { jest } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGitWorkspace, removeGitWorkspace } from "../../test-fixtures/git-harness.mjs";
import { relativeConfigPath, repositoryRoot } from "../../src/git/repository-location.mjs";

test("finds the repository root from the config directory", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = jest.fn().mockResolvedValue({ stdout: `${directory}\n` });
  try {
    await expect(repositoryRoot(config, git)).resolves.toBe(directory);
    expect(git).toHaveBeenCalledWith(["rev-parse", "--show-toplevel"], directory);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("returns null when the config is outside a Git repository", async () => {
  const git = jest.fn().mockRejectedValue(
    Object.assign(new Error("not a repository"), {
      stderr: "fatal: not a git repository",
    }),
  );
  await expect(repositoryRoot("/tmp/config.boot", git)).resolves.toBeNull();
});

test("resolves config paths inside a repository and rejects paths outside it", async () => {
  const { directory, config } = await createGitWorkspace();
  const outside = await mkdtemp(join(tmpdir(), "vyops-outside-"));
  const outsideConfig = join(outside, "config.boot");
  await writeFile(outsideConfig, "system {}\n");
  try {
    await expect(relativeConfigPath(directory, config)).resolves.toBe("config.boot");
    await expect(relativeConfigPath(directory, outsideConfig)).rejects.toThrow(
      "configuration path is outside the Git repository",
    );
  } finally {
    await rm(outside, { recursive: true, force: true });
    await removeGitWorkspace(directory);
  }
});
