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
