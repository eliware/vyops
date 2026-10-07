import { jest } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { repositorySnapshot, shouldSkip, pushBack } from "../../src/git.mjs";
import { repositoryState } from "../../src/git/repository-state.mjs";
const run = promisify(execFile);
async function git(cwd, ...args) {
  await run("git", args, { cwd });
}

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "vyops-git-test-"));
  await git(directory, "init");
  await git(directory, "config", "user.email", "test@example.invalid");
  await git(directory, "config", "user.name", "Test");
  const config = join(directory, "config.boot");
  await writeFile(config, "system {}\n");
  await writeFile(`${config}.manifest.tsv`, "kind\tpath\n");
  await git(directory, "add", "config.boot", "config.boot.manifest.tsv");
  await git(directory, "commit", "-m", "Initial");
  return { directory, config };
}

test("repository snapshots identify detached HEAD state", async () => {
  const { directory, config } = await repository();
  try {
    await git(directory, "checkout", "--detach", "HEAD");
    await expect(repositorySnapshot(config)).resolves.toMatchObject({
      state: expect.stringContaining("\nDETACHED\n"),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("handles absolute config paths with normalized separators", async () => {
  const { directory, config } = await repository();
  const normalizedConfig = config.replaceAll("\\", "/");
  await expect(shouldSkip(normalizedConfig)).resolves.toBe(false);
  await expect(pushBack(normalizedConfig)).resolves.toBe(false);
  await rm(directory, { recursive: true, force: true });
});

test("pushBack handles a changed repository-relative config path", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, "system {\n    host-name changed\n}\n");
    await expect(pushBack("config.boot")).rejects.toThrow("No configured push destination");
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("Git integration is optional outside a repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-no-git-"));
  const config = join(directory, "config.boot");
  await writeFile(config, "system {}\n");
  try {
    await expect(shouldSkip(config)).resolves.toBe(false);
    await expect(repositorySnapshot(config)).resolves.toBeNull();
    await expect(pushBack(config)).resolves.toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Git integration propagates unexpected repository errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-invalid-git-"));
  const parent = join(directory, "not-a-directory");
  await writeFile(parent, "not a directory\n");
  try {
    await expect(shouldSkip(join(parent, "config.boot"))).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("joins Git state fields into a snapshot", async () => {
  const git = jest.fn(async ([command]) => ({ stdout: command === "rev-parse" ? "head\n" : "" }));
  await expect(repositoryState(git, "repo", "config.boot")).resolves.toContain("head");
  expect(git).toHaveBeenCalledTimes(5);
});

test("pushBack refuses a repository changed during deployment", async () => {
  const { directory, config } = await repository();
  const snapshot = await repositorySnapshot(config);
  await writeFile(config, "system {\n    host-name changed\n}\n");
  await expect(
    pushBack(config, { expectedState: { ...snapshot, state: `${snapshot.state}stale` } }),
  ).rejects.toThrow("repository changed during deployment; refusing to commit");
  await expect(run("git", ["log", "-1", "--format=%s"], { cwd: directory })).resolves.toMatchObject(
    { stdout: "Initial\n" },
  );
  await rm(directory, { recursive: true, force: true });
});

test("pushBack still refuses unrelated repository changes during deployment", async () => {
  const { directory, config } = await repository();
  const snapshot = await repositorySnapshot(config);
  await writeFile(config, "system {\n    host-name changed\n}\n");
  await writeFile(join(directory, "other.txt"), "concurrent change\n");
  try {
    await expect(pushBack(config, { expectedState: snapshot })).rejects.toThrow(
      "repository changed during deployment; refusing to commit",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pushBack refuses a repository changed after diff calculation", async () => {
  const { directory, config } = await repository();
  await writeFile(config, "system {\n    host-name changed\n}\n");
  try {
    await expect(
      pushBack(config, {
        beforeCommit: async (repo) =>
          writeFile(join(repo, "created-during-pushback.txt"), "changed\n"),
      }),
    ).rejects.toThrow("repository changed during pushback; refusing to commit");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
