import { jest } from "@jest/globals";

const exec = jest.fn();
jest.unstable_mockModule("../../../../src/ssh/exec.mjs", () => ({ exec }));
const { writeInstalledScriptManifest } =
  await import("../../../../src/deploy/script/manifest/write.mjs");

beforeEach(() => exec.mockReset().mockResolvedValue({ code: 0, stdout: "", stderr: "" }));

test("runs the remote manifest update", async () => {
  await writeInstalledScriptManifest({
    client: {},
    name: "nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
    redact: (value) => value,
  });
  expect(exec).toHaveBeenCalledTimes(1);
  expect(exec.mock.calls[0][0]).toEqual({});
});

test.each([
  [{ code: 1, stderr: "denied", stdout: "" }, "denied"],
  [{ code: 1, stderr: "", stdout: "manifest output" }, "redacted"],
])("reports manifest write failures", async (result, message) => {
  exec.mockResolvedValue(result);
  await expect(
    writeInstalledScriptManifest({
      client: {},
      name: "hook.sh",
      installed: "/config/scripts/hook.sh",
      manifest: "/tmp/manifest.tsv",
      redact: (value) => (value === "manifest output" ? "redacted" : value),
    }),
  ).rejects.toThrow(`manifest update failed (hook.sh): ${message}`);
});
