import { jest } from "@jest/globals";
import { publishBackupEntries } from "../../src/backup/publication-transaction.mjs";

const entries = ["config.boot"];

test("restores prior entries when staged publication fails", async () => {
  const fs = {
    rename: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("install failed"))
      .mockResolvedValueOnce(undefined),
    rm: jest.fn(),
  };
  await expect(publishBackupEntries(fs, entries, "staged", "output", "previous")).rejects.toThrow(
    "install failed",
  );
  expect(fs.rename).toHaveBeenLastCalledWith("previous/config.boot", "output/config.boot");
});

test("removes a partial destination entry before restoring the prior entry", async () => {
  const fs = {
    rename: jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error("destination exists"), { code: "EEXIST" }))
      .mockResolvedValueOnce(undefined),
    rm: jest.fn(),
  };
  await expect(
    publishBackupEntries(fs, ["config.boot", "scripts"], "staged", "output", "previous"),
  ).rejects.toThrow("destination exists");
  expect(fs.rm).toHaveBeenCalledWith("output/scripts", { recursive: true, force: true });
  expect(fs.rename).toHaveBeenCalledWith("previous/scripts", "output/scripts");
});
