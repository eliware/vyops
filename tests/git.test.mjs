import {
  filesystem,
  promises,
  resetMemoryFilesystem,
} from "../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs", () => filesystem);
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdir, writeFile } = await import("node:fs/promises");
const { promises: fs } = await import("node:fs");
import { join } from "node:path";
const defaultGit = jest.fn();
await jest.unstable_mockModule("../src/git/command.mjs", () => ({ runGit: defaultGit }));
const { repositorySnapshot, shouldSkip, pushBack } = await import("../src/git.mjs");
const { repositoryRoot } = await import("../src/git/pushback.mjs");
const { createGitMock, createGitWorkspace, removeGitWorkspace } =
  await import("../test-fixtures/git-harness.mjs");

test("git checks use the config directory and skip unchanged pushback commits", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "log") return { stdout: "Pushback test\n" };
  });
  try {
    await expect(shouldSkip(config, git)).resolves.toBe(true);
    expect(git).toHaveBeenCalledWith(["rev-parse", "--show-toplevel"], directory);
    expect(git).toHaveBeenCalledWith(
      [
        "status",
        "--porcelain",
        "--",
        "config.boot",
        "config.boot.manifest.tsv",
        "config.boot.deployment.tsv",
      ],
      directory,
    );
  } finally {
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
  const { directory } = await createGitWorkspace("relative-", process.cwd());
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "log") return { stdout: "Pushback relative\n" };
  });
  try {
    await expect(shouldSkip("config.boot", git)).resolves.toBe(true);
  } finally {
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

function lockPath(directory) {
  return join(directory, ".git", "vyops-pushback.lock");
}

async function makeLock(directory, owner) {
  const lock = lockPath(directory);
  await mkdir(lock);
  await writeFile(join(lock, "owner"), `${owner}\n`);
}

test("rejects an active pushback lock", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await makeLock(directory, String(process.pid));
    await expect(pushBack(config, { runGit: git })).rejects.toThrow("a pushback is in progress");
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("propagates lock creation errors other than contention", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  const originalMkdir = fs.mkdir;
  const mkdirSpy = jest.spyOn(fs, "mkdir").mockImplementation(async (lock, options) => {
    if (String(lock).endsWith("vyops-pushback.lock"))
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    return await originalMkdir(lock, options);
  });
  try {
    await expect(pushBack(config, { runGit: git })).rejects.toThrow("permission denied");
  } finally {
    mkdirSpy.mockRestore();
    await removeGitWorkspace(directory);
  }
});
