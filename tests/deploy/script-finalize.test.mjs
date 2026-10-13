import { jest } from "@jest/globals";
import { finalizeScripts } from "../../src/deploy/script-finalize.mjs";

test("removes backup state after committed deployment", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await finalizeScripts(
    exec,
    { warn: jest.fn() },
    {
      client: {},
      committed: true,
      backupDir: "/tmp/b",
      remoteDir: "/tmp/r",
    },
  );
  expect(exec.mock.calls[0][1]).toContain("rm -rf");
});

test("warns when committed cleanup fails", async () => {
  const exec = jest.fn().mockRejectedValue(new Error("cleanup failed"));
  const log = { warn: jest.fn() };
  await finalizeScripts(exec, log, { committed: true, backupDir: "/tmp/b", remoteDir: "/tmp/r" });
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("hook cleanup failed"));
});
