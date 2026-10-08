import { jest } from "@jest/globals";
import { publishBackup } from "../../src/backup/publish-backup.mjs";

test("replaces bundle files while it preserves other destination files", async () => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn(),
  };
  await publishBackup(fs, "staged", "output", "previous");
  expect(fs.rename).toHaveBeenCalledTimes(6);
  expect(fs.rm).toHaveBeenCalledWith("previous", { recursive: true, force: true });
});

test("publishes a bundle when no old files exist", async () => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest.fn(async (source) => {
      if (source.startsWith("output/"))
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    rm: jest.fn(),
  };
  await publishBackup(fs, "staged", "output", "previous");
  expect(fs.rename).toHaveBeenCalledTimes(6);
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
  expect(fs.rm).toHaveBeenCalledWith("output/config.boot", { recursive: true, force: true });
  expect(fs.rename).toHaveBeenCalledWith("previous/config.boot", "output/config.boot");
});
test("does not hide failures while restoring old files", async () => {
  const fs = {
    mkdir: jest.fn(),
    rename: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("install failed"))
      .mockRejectedValueOnce(new Error("restore failed")),
    rm: jest.fn(),
  };
  await expect(publishBackup(fs, "staged", "output", "previous")).rejects.toThrow(
    "prior files remain in previous: restore failed",
  );
});
