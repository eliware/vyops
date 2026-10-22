import {
  filesystem,
  promises,
  resetMemoryFilesystem,
} from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs", () => filesystem);
jest.unstable_mockModule("node:fs/promises", () => promises);
const { promises: fs } = await import("node:fs");
import { join } from "node:path";
const { mkdir, writeFile } = await import("node:fs/promises");
const { pushBack } = await import("../../src/git/pushback.mjs");
const { createGitMock, createGitWorkspace, removeGitWorkspace } =
  await import("../../test-fixtures/git-harness.mjs");

function lockPath(directory) {
  return join(directory, ".git", "vyops-pushback.lock");
}

test("pushBack returns false when config has no diff", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await expect(pushBack(config, { runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("pushBack returns false when config is outside a Git repository", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async () => {
    throw Object.assign(new Error("not a git repository"), {
      stderr: "fatal: not a git repository",
    });
  });
  try {
    await expect(pushBack(config, { runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("pushback rejects a configuration outside the repository", async () => {
  const { directory } = await createGitWorkspace();
  await mkdir(`${directory}/sub`);
  const linked = `${directory}/sub/config.boot`;
  const outside = join(directory, "..", "outside-config.boot");
  await writeFile(outside, "system {}\n");
  const realpath = jest
    .spyOn(fs, "realpath")
    .mockImplementation(async (value) => (String(value) === directory ? directory : outside));
  const git = createGitMock(jest, directory);
  try {
    await expect(pushBack(linked, { runGit: git })).rejects.toThrow(
      "configuration path is outside the Git repository",
    );
  } finally {
    realpath.mockRestore();
    await removeGitWorkspace(directory);
  }
});

test("pushBack commits and pushes a changed config", async () => {
  const { directory, config } = await createGitWorkspace();
  await writeFile(`${config}.deployment.tsv`, "kind\tpath\tstate\n");
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
  });
  try {
    await expect(pushBack(config, { runGit: git })).resolves.toBe(true);
    expect(git).toHaveBeenCalledWith(
      ["add", "--", "config.boot", "config.boot.manifest.tsv", "config.boot.deployment.tsv"],
      directory,
    );
    expect(git.mock.calls.some(([args]) => args[0] === "commit")).toBe(true);
    expect(git).toHaveBeenCalledWith(["push"], directory);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("pushBack reports a push failure after the local commit", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
    if (args[0] === "push")
      throw Object.assign(new Error("no remote configured"), { stderr: "no remote" });
  });
  try {
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      /git push failed after local commit head; branch: main; upstream: origin\/main; error: no remote; recovery: git push/,
    );
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("does not reclaim a lock with missing owner metadata", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await mkdir(lockPath(directory));
    await expect(pushBack(config, { runGit: git })).rejects.toThrow("a pushback is in progress");
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("force does not reclaim a lock owned by a live process", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await mkdir(lockPath(directory));
    await writeFile(join(lockPath(directory), "owner"), `${process.pid}\n`);
    await expect(pushBack(config, { force: true, runGit: git })).rejects.toThrow(
      "a pushback is in progress",
    );
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("force reclaims a lock with invalid owner metadata", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await mkdir(lockPath(directory));
    await writeFile(join(lockPath(directory), "owner"), "invalid\n");
    await expect(pushBack(config, { force: true, runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});
