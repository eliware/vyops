import { jest } from "@jest/globals";
const { publishBackup } = await import("../../src/backup/publish-backup.mjs");

test.each([false, true])("publishes a bundle with no previous files: %s", async (missing) => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest.fn(async (source) => {
      if (missing && source.startsWith("output/"))
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    rm: jest.fn(),
  };
  await publishBackup(fs, "staged", "output", "previous");
  expect(fs.rename).toHaveBeenCalledTimes(6);
  expect(fs.rm).toHaveBeenCalledWith("previous", { recursive: true, force: true });
});

test("reports errors while saving the old bundle", async () => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest.fn().mockRejectedValue(new Error("save failed")),
    rm: jest.fn(),
  };
  await expect(publishBackup(fs, "staged", "output", "previous")).rejects.toThrow("save failed");
});

test("restores old files when installing a staged file fails", async () => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("install failed"))
      .mockResolvedValue(undefined),
    rm: jest.fn(),
  };
  await expect(publishBackup(fs, "staged", "output", "previous")).rejects.toThrow("install failed");
});

test("reports prior backup cleanup failure after successful publication", async () => {
  const log = { warn: jest.fn() };
  const fs = {
    mkdir: jest.fn(),
    rename: jest.fn(),
    rm: jest.fn().mockRejectedValue(new Error("cleanup denied")),
  };
  await expect(publishBackup(fs, "staged", "output", "previous", log)).resolves.toBeUndefined();
  expect(log.warn).toHaveBeenCalledWith(
    "VyOps backup cleanup warning: prior backup removal failed: cleanup denied",
  );
});
