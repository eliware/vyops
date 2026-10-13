import { jest } from "@jest/globals";
import { snapshotRemoteScript } from "../../src/backup/remote-script-snapshot.mjs";

test("creates the snapshot in a private remote directory", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id");
  const command = exec.mock.calls[0][1];
  expect(command).toContain("mkdir -m 700 -- '/tmp/.vyops-backup.run-id'");
  expect(command).toContain("cat <&3 > '/tmp/.vyops-backup.run-id/script'");
  expect(command).toContain("rm -rf -- '/tmp/.vyops-backup.run-id'");
});

test("rejects a failed remote snapshot", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 1, stdout: "", stderr: "snapshot failed" });
  await expect(
    snapshotRemoteScript(exec, {}, "/config/scripts/hook.sh", "/tmp/.vyops-backup.run-id"),
  ).rejects.toThrow("remote script changed or is not a regular file: /config/scripts/hook.sh");
});
