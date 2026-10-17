import { jest } from "@jest/globals";

const exec = jest.fn();
jest.unstable_mockModule("../../../src/ssh/exec.mjs", () => ({ exec }));
const { recordScriptState } = await import("../../../src/deploy/script/record-state.mjs");

beforeEach(() => exec.mockReset().mockResolvedValue({ code: 0, stdout: "", stderr: "" }));

test("records a script and its directory state before upload", async () => {
  await recordScriptState({
    client: {},
    name: "nested/hook.sh",
    parent: "nested",
    installDir: "/config/scripts",
    backupDir: "/tmp/backup",
    backup: "/tmp/backup/nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
    redact: (text) => text,
  });
  expect(exec).toHaveBeenCalledTimes(1);
  expect(exec.mock.calls[0][1]).toContain("directory\\t%s");
  expect(exec.mock.calls[0][1]).toContain("destination is a symlink");
  expect(exec.mock.calls[0][1]).toContain("sha256sum");
});

test("reports remote backup errors", async () => {
  exec.mockResolvedValue({ code: 1, stderr: "denied", stdout: "" });
  await expect(
    recordScriptState({
      client: {},
      name: "hook.sh",
      parent: ".",
      installDir: "/config/scripts",
      backupDir: "/tmp/backup",
      backup: "/tmp/backup/hook.sh",
      installed: "/config/scripts/hook.sh",
      manifest: "/tmp/manifest.tsv",
      redact: (text) => text,
    }),
  ).rejects.toThrow("script backup failed (hook.sh): denied");
});
