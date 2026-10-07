import { pushFailure } from "../../src/git/push-failure.mjs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { pushBack } from "../../src/git/pushback.mjs";
const run = promisify(execFile);
async function git(cwd, ...args) {
  await run("git", args, { cwd });
}

test("reports available push recovery metadata", async () => {
  const git = async ([command]) => ({ stdout: command === "rev-parse" ? "abc123\n" : "main\n" });
  await expect(
    pushFailure(
      git,
      "repo",
      Object.assign(new Error("push failed"), { stderr: "remote rejected" }),
    ),
  ).resolves.toMatchObject({ message: expect.stringContaining("commit abc123; branch: main") });
});

test("uses safe fallbacks when push recovery metadata is unavailable", async () => {
  const git = async () => {
    throw new Error("metadata unavailable");
  };
  await expect(pushFailure(git, "repo", new Error("push failed"))).resolves.toMatchObject({
    message: expect.stringContaining("commit unknown; branch: DETACHED; upstream: (none)"),
  });
});

test("push failure remains clear when repository metadata cannot be read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-push-metadata-"));
  const remote = join(directory, "remote.git");
  await git(directory, "init", "--bare", remote);
  const repo = join(directory, "repo");
  await git(directory, "clone", remote, repo);
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Test");
  const config = join(repo, "config.boot");
  await writeFile(config, "system {}\n");
  await git(repo, "add", "config.boot");
  await git(repo, "commit", "-m", "Initial");
  await git(repo, "push", "-u", "origin", "HEAD");
  await writeFile(config, "system {\n    host-name changed\n}\n");
  const hook = join(repo, ".git", "hooks", "pre-push");
  await writeFile(hook, "#!/bin/sh\nrm -f .git/HEAD\nexit 1\n");
  await chmod(hook, 0o755);
  try {
    await expect(pushBack(config)).rejects.toThrow(
      /git push failed after local commit unknown; branch: DETACHED; upstream: \(none\)/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
