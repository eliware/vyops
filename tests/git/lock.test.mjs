import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { jest } from "@jest/globals";
import { withRepositoryLock } from "../../src/git/lock.mjs";
import { pushBack } from "../../src/git.mjs";

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
  await git(directory, "add", "config.boot");
  await git(directory, "commit", "-m", "Initial");
  return { directory, config };
}
function lockPath(directory) {
  return join(directory, ".git", "vyops-pushback.lock");
}

async function makeLock(directory, owner = "not-a-pid", old = true) {
  const lock = lockPath(directory);
  await mkdir(lock);
  await writeFile(join(lock, "owner"), `${owner}\n`);
  if (old) {
    const time = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(lock, time, time);
  }
  return lock;
}

test("rejects an active pushback lock", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await makeLock(directory, String(process.pid), false);
    await expect(pushBack("config.boot")).rejects.toThrow("another pushback is already running");
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("reclaims stale and malformed pushback locks", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await makeLock(directory);
    await expect(pushBack("config.boot")).resolves.toBe(false);
    await makeLock(directory, "999999999", false);
    await expect(pushBack("config.boot", { force: true })).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test.each([
  ["EPERM", "EPERM"],
  ["unexpected kill error", "EINVAL"],
])("keeps a lock when process check returns %s", async (_label, code) => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error(code), { code });
  });
  try {
    await makeLock(directory, "12345");
    await expect(pushBack("config.boot")).rejects.toThrow("another pushback is already running");
  } finally {
    kill.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("reclaims a lock owned by a dead process", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("dead"), { code: "ESRCH" });
  });
  try {
    await makeLock(directory, "12345", false);
    await expect(pushBack("config.boot")).resolves.toBe(false);
  } finally {
    kill.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not reclaim a lock with missing owner metadata", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await mkdir(lockPath(directory));
    await expect(pushBack("config.boot")).rejects.toThrow("another pushback is already running");
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("propagates lock creation errors other than contention", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const mkdirSpy = jest.spyOn(fs, "mkdir").mockImplementation(async (lock) => {
    if (String(lock).endsWith("vyops-pushback.lock"))
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    return undefined;
  });
  try {
    await expect(pushBack("config.boot")).rejects.toThrow("permission denied");
  } finally {
    mkdirSpy.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("runs the protected action", async () => {
  await expect(withRepositoryLock(process.cwd(), async () => "done", false)).resolves.toBe("done");
});
