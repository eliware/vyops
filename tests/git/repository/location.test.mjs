import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { createGitWorkspace, removeGitWorkspace } =
  await import("../../../test-fixtures/git-harness.mjs");
const { repositoryRoot } = await import("../../../src/git/repository/location.mjs");

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
