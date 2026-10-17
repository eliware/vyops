import { jest } from "@jest/globals";
const { snapshotRemoteScript } = await import("../../../../src/backup/remote/script/snapshot.mjs");

test("creates the snapshot in a private remote directory", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id");
  const command = exec.mock.calls[0][1];
  expect(command).toContain("mkdir -m 700 -- '/tmp/.vyops-backup.run-id'");
  expect(command).toContain("test ! -L '/config/scripts/hook.sh'");
  expect(command).toContain("cat <&3 > '/tmp/.vyops-backup.run-id/script'");
  expect(command).not.toContain("rm -rf");
});

test("rejects a failed remote snapshot", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "snapshot failed" })
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote script changed or is not a regular file: /config/scripts/hook.sh");
  expect(exec.mock.calls[1][1]).toBe("rm -rf -- '/tmp/.vyops-backup.run-id'");
});

test("reports a failed remote snapshot cleanup", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "snapshot failed" })
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "permission denied" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote snapshot cleanup failed: permission denied");
});

test("reports snapshot cleanup output when cleanup fails", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "snapshot failed" })
    .mockResolvedValueOnce({ code: 1, stdout: "cleanup failed", stderr: "" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote snapshot cleanup failed: cleanup failed");
});

test("reports snapshot cleanup exit code when cleanup has no output", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "snapshot failed" })
    .mockResolvedValueOnce({ code: 2, stdout: "", stderr: "" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote snapshot cleanup failed: exit code 2");
});

test("cleans up after a snapshot command error", async () => {
  const cause = new Error("connection failed");
  const exec = jest
    .fn()
    .mockRejectedValueOnce(cause)
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toBe(cause);
});
