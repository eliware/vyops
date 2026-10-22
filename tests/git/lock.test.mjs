import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";

beforeEach(() => resetMemoryFilesystem());
const { mkdtemp, mkdir, rm, access } = promises;
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
