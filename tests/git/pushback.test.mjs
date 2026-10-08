import { promises as fs } from "node:fs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { jest } from "@jest/globals";
import { pushBack } from "../../src/git/pushback.mjs";
import {
  createGitMock,
  createGitWorkspace,
  removeGitWorkspace,
} from "../../test-fixtures/git-harness.mjs";

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
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
  });
  try {
    await expect(pushBack(config, { runGit: git })).resolves.toBe(true);
    expect(git).toHaveBeenCalledWith(
      ["add", "--", "config.boot", "config.boot.manifest.tsv"],
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

test("pushBack preserves staged content when the worktree also changed", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "status" && args[2] === "-z") return { stdout: "MM config.boot\0" };
  });
  try {
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      "configuration or manifest has staged and unstaged changes; refusing to overwrite staged content",
    );
  } finally {
    await removeGitWorkspace(directory);
  }
});
