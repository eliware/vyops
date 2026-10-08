import { jest } from "@jest/globals";
import { chdir } from "node:process";
const defaultGit = jest.fn();
await jest.unstable_mockModule("../src/git/command.mjs", () => ({ runGit: defaultGit }));
const { repositorySnapshot, shouldSkip, pushBack } = await import("../src/git.mjs");
const { repositoryRoot } = await import("../src/git/pushback.mjs");
import {
  createGitMock,
  createGitWorkspace,
  removeGitWorkspace,
} from "../test-fixtures/git-harness.mjs";

test("git checks use the config directory and skip unchanged pushback commits", async () => {
  const { directory, config } = await createGitWorkspace();
  const outside = process.cwd();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "log") return { stdout: "Pushback test\n" };
  });
  chdir(outside);
  try {
    await expect(shouldSkip(config, git)).resolves.toBe(true);
    expect(git).toHaveBeenCalledWith(["rev-parse", "--show-toplevel"], directory);
    expect(git).toHaveBeenCalledWith(["status", "--porcelain", "--", "config.boot"], directory);
  } finally {
    chdir(outside);
    await removeGitWorkspace(directory);
  }
});

test("shouldSkip is false for a changed config", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "status") return { stdout: " M config.boot\n" };
  });
  try {
    await expect(shouldSkip(config, git)).resolves.toBe(false);
    expect(git).not.toHaveBeenCalledWith(["log", "-1", "--format=%s"], directory);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("shouldSkip accepts a repository-relative config path", async () => {
  const { directory } = await createGitWorkspace();
  const outside = process.cwd();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "log") return { stdout: "Pushback relative\n" };
  });
  chdir(directory);
  try {
    await expect(shouldSkip("config.boot", git)).resolves.toBe(true);
  } finally {
    chdir(outside);
    await removeGitWorkspace(directory);
  }
});

test("Git functions use the shared runner by default", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "log") return { stdout: "Pushback default\n" };
  });
  defaultGit.mockImplementation((args, cwd) => git(args, cwd));
  try {
    await expect(shouldSkip(config)).resolves.toBe(true);
    await expect(repositoryRoot(config)).resolves.toBe(directory);
    await expect(repositorySnapshot(config)).resolves.toMatchObject({ repo: directory });
    await expect(pushBack(config)).resolves.toBe(false);
    expect(defaultGit).toHaveBeenCalled();
  } finally {
    defaultGit.mockReset();
    await removeGitWorkspace(directory);
  }
});
