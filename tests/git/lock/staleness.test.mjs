import { jest } from "@jest/globals";
jest.useFakeTimers();
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";

beforeEach(() => {
  resetMemoryFilesystem();
  jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
});
const { mkdtemp, mkdir, rm, writeFile, utimes } = promises;
const { staleLock } = await import("../../../src/git/lock/staleness.mjs");

async function makeLock(owner) {
  const root = await mkdtemp("/virtual/staleness-");
  const lock = `${root}/lock`;
  await mkdir(lock);
  if (owner !== undefined) await writeFile(`${lock}/owner`, `${owner}\n`);
  return { root, lock };
}

test("keeps a lock when owner metadata is missing", async () => {
  const { root, lock } = await makeLock();
  await expect(staleLock(lock, true)).resolves.toBe(false);
  await rm(root, { recursive: true, force: true });
});

test.each([
  ["live process", undefined, false],
  ["permission denied", "EPERM", false],
  ["unknown process error", "EINVAL", false],
  ["exited process", "ESRCH", true],
])("checks the owner process when it is a positive PID: %s", async (_label, code, expected) => {
  const { root, lock } = await makeLock("424242");
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    if (code) throw Object.assign(new Error(code), { code });
  });
  try {
    await expect(staleLock(lock, true)).resolves.toBe(expected);
  } finally {
    kill.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});

test("uses lock age and force when owner metadata has no valid process ID", async () => {
  const { root, lock } = await makeLock("not-a-process");
  await utimes(lock, new Date(), new Date());
  await expect(staleLock(lock, false)).resolves.toBe(false);
  await expect(staleLock(lock, true)).resolves.toBe(true);
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(lock, old, old);
  await expect(staleLock(lock, false)).resolves.toBe(true);
  await rm(root, { recursive: true, force: true });
});
