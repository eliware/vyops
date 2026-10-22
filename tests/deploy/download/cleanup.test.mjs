import { jest } from "@jest/globals";
import { cleanupDownloadedFiles } from "../../../src/deploy/download/cleanup.mjs";

test("removes temporary and prior files after a completed rollback", async () => {
  const fs = { rm: jest.fn() };
  await cleanupDownloadedFiles(fs, [{ temporary: "temp", previous: "prior" }], true);
  expect(fs.rm.mock.calls).toEqual([
    ["temp", { force: true }],
    ["prior", { force: true }],
  ]);
});

test("keeps prior files when rollback is incomplete and reports cleanup failures", async () => {
  const fs = { rm: jest.fn().mockRejectedValue(new Error("denied")) };
  const log = { warn: jest.fn() };
  await cleanupDownloadedFiles(fs, [{ temporary: "temp", previous: "prior" }], false, log);
  expect(fs.rm).toHaveBeenCalledTimes(1);
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("denied"));
});
