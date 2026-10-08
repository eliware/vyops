import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { jest } from "@jest/globals";
import { repositorySnapshot } from "../../src/git.mjs";
import { pushBack } from "../../src/git/pushback.mjs";

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

test("pushBack returns false when config has no diff", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await expect(pushBack("config.boot")).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("pushBack returns false when config is outside a Git repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-no-git-test-"));
  const config = join(directory, "config.boot");
  await writeFile(config, "system {}\n");
  await expect(pushBack(config)).resolves.toBe(false);
  await rm(directory, { recursive: true, force: true });
});

test("pushback rejects a configuration outside the repository", async () => {
  const { directory } = await repository();
  await mkdir(join(directory, "sub"));
  const outside = join(directory, "..", "outside-config.boot");
  await writeFile(outside, "system {}\n");
  const linked = join(directory, "sub", "config.boot");
  const realpath = jest
    .spyOn(fs, "realpath")
    .mockImplementation(async (value) => (String(value) === directory ? directory : outside));
  try {
    await expect(pushBack(linked)).rejects.toThrow(
      "configuration path is outside the Git repository",
    );
  } finally {
    realpath.mockRestore();
    await rm(outside, { force: true });
    await rm(directory, { recursive: true, force: true });
  }
});

test("pushBack commits and pushes a changed config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-remote-"));
  const remote = join(directory, "remote.git");
  await git(directory, "init", "--bare", remote);
  const repo = join(directory, "repo");
  await git(directory, "clone", remote, repo);
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Test");
  const config = join(repo, "config.boot");
  await writeFile(config, "system {\n    host-name initial\n}\n");
  await git(repo, "add", "config.boot");
  await git(repo, "commit", "-m", "Initial");
  await git(repo, "push", "-u", "origin", "HEAD");
  const snapshot = await repositorySnapshot(config);
  await writeFile(config, "system {\n    host-name changed\n}\n");
  await writeFile(`${config}.manifest.tsv`, "kind\tpath\nfile\thealth.sh\n");
  const previous = process.cwd();
  process.chdir(repo);
  try {
    await expect(pushBack(config, { expectedState: snapshot })).resolves.toBe(true);
    await expect(run("git", ["log", "-1", "--format=%s"], { cwd: repo })).resolves.toMatchObject({
      stdout: expect.stringMatching(/^Pushback /),
    });
    await expect(
      run("git", ["show", "--format=", "--name-only", "HEAD"], { cwd: repo }),
    ).resolves.toMatchObject({ stdout: expect.stringContaining("config.boot.manifest.tsv") });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("pushBack includes staged config changes", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, "system {\n    host-name staged\n}\n");
    await git(directory, "add", "config.boot");
    await expect(pushBack(config)).rejects.toThrow(
      /git push failed after local commit [0-9a-f]+; branch: [\s\S]*; upstream: \(none\); error: [\s\S]*; recovery: git push/,
    );
    await expect(
      run("git", ["show", "--format=%s", "--stat", "--oneline", "HEAD"], { cwd: directory }),
    ).resolves.toMatchObject({ stdout: expect.stringContaining("Pushback ") });
    await expect(
      run("git", ["show", "HEAD:config.boot"], { cwd: directory }),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("host-name staged"),
    });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("pushBack preserves staged content when the worktree has a different config", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, "system {\n    host-name staged\n}\n");
    await git(directory, "add", "config.boot");
    await writeFile(config, "system {\n    host-name worktree\n}\n");

    await expect(pushBack(config)).rejects.toThrow(
      "configuration or manifest has staged and unstaged changes; refusing to overwrite staged content",
    );
    await expect(run("git", ["show", ":config.boot"], { cwd: directory })).resolves.toMatchObject({
      stdout: expect.stringContaining("host-name staged"),
    });
    await expect(
      run("git", ["show", "HEAD:config.boot"], { cwd: directory }),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("system {}"),
    });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});
