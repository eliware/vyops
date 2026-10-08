import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { jest } from "@jest/globals";
import { withRepositoryLock } from "../../src/git/lock.mjs";
import { pushBack } from "../../src/git.mjs";
import {
  createGitMock,
  createGitWorkspace,
  removeGitWorkspace,
} from "../../test-fixtures/git-harness.mjs";

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
}

test("rejects an active pushback lock", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await makeLock(directory, String(process.pid), false);
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      "another pushback is already running",
    );
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("reclaims stale and malformed pushback locks", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await makeLock(directory);
    await expect(pushBack(config, { runGit: git })).resolves.toBe(false);
    await makeLock(directory, "999999999", false);
    await expect(pushBack(config, { force: true, runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test.each([
  ["EPERM", "EPERM"],
  ["unexpected kill error", "EINVAL"],
])("keeps a lock when process check returns %s", async (_label, code) => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error(code), { code });
  });
  try {
    await makeLock(directory, "12345");
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      "another pushback is already running",
    );
  } finally {
    kill.mockRestore();
    await removeGitWorkspace(directory);
  }
});

test("reclaims a lock owned by a dead process", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("dead"), { code: "ESRCH" });
  });
  try {
    await makeLock(directory, "12345", false);
    await expect(pushBack(config, { runGit: git })).resolves.toBe(false);
  } finally {
    kill.mockRestore();
    await removeGitWorkspace(directory);
  }
});

test("does not reclaim a lock with missing owner metadata", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await mkdir(lockPath(directory));
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      "another pushback is already running",
    );
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

test("runs the protected action", async () => {
  await expect(withRepositoryLock(process.cwd(), async () => "done", false)).resolves.toBe("done");
});
