import { jest } from "@jest/globals";

const exec = jest.fn();
jest.unstable_mockModule("../../src/ssh.mjs", () => ({
  close: jest.fn(),
  connect: jest.fn(),
  download: jest.fn(),
  exec,
}));
const { remoteScriptPath, snapshotRemoteScript, validateRemoteScript } =
  await import("../../src/backup/remote-script.mjs");

beforeEach(() => exec.mockReset());

test("accepts a stable regular remote script", async () => {
  exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).resolves.toBeUndefined();
  expect(exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("realpath"));
});

test("rejects a remote script whose metadata check fails", async () => {
  exec.mockResolvedValue({ code: 1, stdout: "", stderr: "changed" });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).rejects.toThrow(
    "remote script changed or is not a regular file: /config/scripts/hook.sh",
  );
});

test("accepts a systemd template path with an at sign", () => {
  expect(remoteScriptPath("/config/scripts/systemd/agent@.service")).toBe("systemd/agent@.service");
});

test("rejects a remote script path with traversal", () => {
  expect(() => remoteScriptPath("/config/scripts/../private")).toThrow("unsafe remote script path");
});

test("creates the snapshot in a private remote directory", async () => {
  exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id");
  const command = exec.mock.calls[0][1];
  expect(command).toContain("mkdir -m 700 -- '/tmp/.vyops-backup.run-id'");
  expect(command).toContain("cat <&3 > '/tmp/.vyops-backup.run-id/script'");
  expect(command).toContain("rm -rf -- '/tmp/.vyops-backup.run-id'");
});

test("rejects a failed remote snapshot", async () => {
  exec.mockResolvedValue({ code: 1, stdout: "", stderr: "snapshot failed" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote script changed or is not a regular file: /config/scripts/hook.sh");
});
