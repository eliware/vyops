import { jest } from "@jest/globals";
const backup = jest.fn();
jest.unstable_mockModule("../../src/backup.mjs", () => ({ backup }));
const { runBackup } = await import("../../src/commands/backup.mjs");
beforeEach(() => jest.clearAllMocks());

test("runs backup and reports success", async () => {
  const log = { debug: jest.fn(), info: jest.fn() };
  const args = { target: "vyos@router", config: "/tmp/config.boot" };
  await runBackup(args, log);
  expect(backup).toHaveBeenCalledWith({ ...args, log });
  expect(log.info).toHaveBeenCalledWith("Backup complete: /tmp/config.boot");
});

test("rejects an invalid target before starting the backup", async () => {
  const log = { debug: jest.fn(), info: jest.fn() };
  await expect(runBackup({ target: "invalid", config: "/tmp/config.boot" }, log)).rejects.toThrow(
    "invalid target",
  );
  expect(backup).not.toHaveBeenCalled();
});
