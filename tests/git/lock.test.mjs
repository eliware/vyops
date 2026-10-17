import { jest } from "@jest/globals";
jest.useFakeTimers();
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";

beforeEach(() => resetMemoryFilesystem());
const { mkdtemp, mkdir, rm, writeFile, utimes, access } = promises;
const { withRepositoryLock } = await import("../../src/git/lock.mjs");

async function repository() {
  const root = await mkdtemp("/virtual/repository-");
  await mkdir(`${root}/.git`);
  return root;
}

test("runs the protected action", async () => {
  const repo = await repository();
  await expect(withRepositoryLock(repo, async () => "done", false)).resolves.toBe("done");
  await expect(access(`${repo}/.git/vyops-pushback.lock`)).rejects.toHaveProperty("code", "ENOENT");
  await rm(repo, { recursive: true, force: true });
});

test("rejects a lock when owner metadata is missing", async () => {
  const repo = await repository();
  const lock = `${repo}/.git/vyops-pushback.lock`;
  await mkdir(lock);
  await expect(withRepositoryLock(repo, async () => "unused", false)).rejects.toThrow(
    "a pushback is in progress",
  );
  await rm(repo, { recursive: true, force: true });
});

test.each([
  ["live process", undefined],
  ["permission error", "EPERM"],
  ["unknown process error", "EINVAL"],
])("keeps a lock for a %s", async (_label, code) => {
  const repo = await repository();
  const lock = `${repo}/.git/vyops-pushback.lock`;
  await mkdir(lock);
  await writeFile(`${lock}/owner`, "424242\n");
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    if (code) throw Object.assign(new Error(code), { code });
  });
  try {
    await expect(withRepositoryLock(repo, async () => "unused", true)).rejects.toThrow(
      "a pushback is in progress",
    );
  } finally {
    kill.mockRestore();
    await rm(repo, { recursive: true, force: true });
  }
});

test("reclaims a lock after its owner process exits", async () => {
  const repo = await repository();
  const lock = `${repo}/.git/vyops-pushback.lock`;
  await mkdir(lock);
  await writeFile(`${lock}/owner`, "424242\n");
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("process ended"), { code: "ESRCH" });
  });
  try {
    await expect(withRepositoryLock(repo, async () => "reclaimed", false)).resolves.toBe(
      "reclaimed",
    );
  } finally {
    kill.mockRestore();
    await rm(repo, { recursive: true, force: true });
  }
});

test("uses lock age and force for invalid owner metadata", async () => {
  const repo = await repository();
  const lock = `${repo}/.git/vyops-pushback.lock`;
  await mkdir(lock);
  await writeFile(`${lock}/owner`, "not-a-process\n");
  await utimes(lock, new Date(), new Date());
  await expect(withRepositoryLock(repo, async () => "unused", false)).rejects.toThrow(
    "a pushback is in progress",
  );
  await expect(withRepositoryLock(repo, async () => "forced", true)).resolves.toBe("forced");
  await rm(repo, { recursive: true, force: true });
});

test("propagates lock creation errors that do not report an existing lock", async () => {
  const repo = await repository();
  const originalMkdir = promises.mkdir;
  const mkdir = jest.spyOn(promises, "mkdir").mockImplementation(async (value, options) => {
    if (String(value).endsWith("vyops-pushback.lock"))
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    return originalMkdir(value, options);
  });
  try {
    await expect(withRepositoryLock(repo, async () => "unused", false)).rejects.toThrow(
      "permission denied",
    );
  } finally {
    mkdir.mockRestore();
    await rm(repo, { recursive: true, force: true });
  }
});

test("removes the lock when the protected action fails", async () => {
  const repo = await repository();
  await expect(
    withRepositoryLock(
      repo,
      async () => {
        throw new Error("action failed");
      },
      false,
    ),
  ).rejects.toThrow("action failed");
  await expect(access(`${repo}/.git/vyops-pushback.lock`)).rejects.toHaveProperty("code", "ENOENT");
  await rm(repo, { recursive: true, force: true });
});
