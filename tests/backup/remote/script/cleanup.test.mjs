import { jest } from "@jest/globals";
import { cleanupRemoteScriptSnapshot } from "../../../../src/backup/remote/script/cleanup.mjs";

test("removes a remote script snapshot", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await cleanupRemoteScriptSnapshot(exec, {}, "/tmp/snapshot", null);
  expect(exec).toHaveBeenCalledWith({}, "rm -rf -- '/tmp/snapshot'");
});

test("reports a failed remote snapshot cleanup", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 1, stderr: "", stdout: "cleanup denied" });
  await expect(cleanupRemoteScriptSnapshot(exec, {}, "/tmp/snapshot", null)).rejects.toThrow(
    "remote snapshot cleanup failed: cleanup denied",
  );
});

test("reports a cleanup failure without adding an exit code by default", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 2, stderr: "", stdout: "" });
  await expect(cleanupRemoteScriptSnapshot(exec, {}, "/tmp/snapshot", null)).rejects.toThrow(
    "remote snapshot cleanup failed: ",
  );
});

test("preserves the operation error when cleanup also fails", async () => {
  const operationError = new Error("download failed");
  const exec = jest.fn().mockResolvedValue({ code: 1, stderr: "cleanup denied", stdout: "" });
  await expect(
    cleanupRemoteScriptSnapshot(exec, {}, "/tmp/snapshot", operationError),
  ).rejects.toMatchObject({
    message: "remote snapshot cleanup failed: cleanup denied",
    cause: operationError,
  });
});

test("reports an SSH error when cleanup cannot run", async () => {
  const exec = jest.fn().mockRejectedValue(new Error("SSH closed"));
  await expect(cleanupRemoteScriptSnapshot(exec, {}, "/tmp/snapshot", null)).rejects.toMatchObject({
    message: "SSH closed",
  });
});
