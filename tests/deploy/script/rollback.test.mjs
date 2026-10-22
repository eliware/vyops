import { jest } from "@jest/globals";
const { rollbackScripts } = await import("../../../src/deploy/script/rollback.mjs");

test("returns failure when script restoration fails", async () => {
  const exec = jest.fn().mockRejectedValue(new Error("transport lost"));
  const log = { warn: jest.fn() };
  await expect(
    rollbackScripts(exec, log, {
      client: {},
      manifest: "/tmp/m.tsv",
      installDir: "/config/scripts",
      backupDir: "/tmp/b",
      remoteDir: "/tmp/r",
    }),
  ).resolves.toBe(false);
});

test("reports a nonzero rollback command result", async () => {
  const log = { warn: jest.fn() };
  await expect(
    rollbackScripts(jest.fn().mockResolvedValue({ code: 1, stderr: "restore failed" }), log, {}),
  ).resolves.toBe(false);
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("restore failed"));
});

test("uses rollback command output when standard error is empty", async () => {
  const log = { warn: jest.fn() };
  await rollbackScripts(
    jest.fn().mockResolvedValue({ code: 1, stderr: "", stdout: "restore output" }),
    log,
    {},
  );
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("restore output"));
});
