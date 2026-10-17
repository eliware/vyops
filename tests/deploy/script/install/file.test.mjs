import { jest } from "@jest/globals";

const exec = jest.fn();
await jest.unstable_mockModule("../../../../src/ssh/exec.mjs", () => ({ exec }));
const { installStagedScript } = await import("../../../../src/deploy/script/install/file.mjs");

beforeEach(() => exec.mockReset().mockResolvedValue({ code: 0, stdout: "", stderr: "" }));

test("runs the install command and reports remote failures", async () => {
  const stagedScript = { name: "hook.sh", mode: 0o755 };
  const options = {
    stagedScript,
    client: {},
    backupDir: "/tmp/backup",
    installDir: "/config/scripts",
    runId: "operation",
    redact: (value) => value,
  };

  await installStagedScript(options);
  expect(exec).toHaveBeenCalledWith(options.client, expect.stringContaining("sudo install -m 755"));

  exec.mockResolvedValue({ code: 1, stdout: "install output", stderr: "" });
  await expect(installStagedScript(options)).rejects.toThrow(
    "script install failed (hook.sh): install output",
  );
});
