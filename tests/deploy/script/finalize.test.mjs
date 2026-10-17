import { jest } from "@jest/globals";
const { finalizeScripts } = await import("../../../src/deploy/script/finalize.mjs");

test("removes backup state after committed deployment", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await expect(
    finalizeScripts(
      exec,
      { warn: jest.fn() },
      {
        client: {},
        committed: true,
        backupDir: "/tmp/b",
        remoteDir: "/tmp/r",
      },
    ),
  ).resolves.toBe(true);
  expect(exec.mock.calls[0][1]).toContain('rm -rf -- "/tmp/r" && sudo rm -rf -- "/tmp/b"');
});

test.each([
  jest.fn().mockRejectedValue(new Error("cleanup failed")),
  jest.fn().mockResolvedValue({ code: 1, stderr: "cleanup failed" }),
  jest.fn().mockResolvedValue({ code: 1, stderr: "", stdout: "cleanup output" }),
])("retains backup state when committed cleanup fails", async (exec) => {
  const log = { warn: jest.fn() };
  await expect(
    finalizeScripts(exec, log, { committed: true, backupDir: "/tmp/b", remoteDir: "/tmp/r" }),
  ).resolves.toBe(false);
  expect(log.warn).toHaveBeenCalledWith(
    expect.stringContaining("post-commit script cleanup failed"),
  );
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Backup remains at /tmp/b"));
});
