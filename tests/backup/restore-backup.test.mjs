import { jest } from "@jest/globals";
import { restoreBackup } from "../../src/backup/restore-backup.mjs";

test("removes new files, restores saved files, and removes the recovery directory", async () => {
  const fs = { rm: jest.fn(), rename: jest.fn() };
  await restoreBackup(
    fs,
    ["config.boot"],
    ["config.boot"],
    "output",
    "previous",
    new Error("install failed"),
  );
  expect(fs.rm).toHaveBeenNthCalledWith(1, "output/config.boot", {
    recursive: true,
    force: true,
  });
  expect(fs.rename).toHaveBeenCalledWith("previous/config.boot", "output/config.boot");
  expect(fs.rm).toHaveBeenNthCalledWith(3, "previous", { recursive: true, force: true });
});

test("reports a restore failure and keeps the original cause", async () => {
  const cause = new Error("install failed");
  const fs = { rm: jest.fn().mockRejectedValue(new Error("remove failed")), rename: jest.fn() };
  await expect(
    restoreBackup(fs, ["config.boot"], [], "output", "previous", cause),
  ).rejects.toMatchObject({
    message: "backup update failed; prior files remain in previous: remove failed",
    cause,
  });
});
