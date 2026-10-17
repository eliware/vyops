import { jest } from "@jest/globals";

const exec = jest.fn();
jest.unstable_mockModule("../../../src/ssh/exec.mjs", () => ({ exec }));
const { writeInstalledScriptManifest } =
  await import("../../../src/deploy/script/manifest-write.mjs");

beforeEach(() => exec.mockReset().mockResolvedValue({ code: 0, stdout: "", stderr: "" }));

test("records installed file metadata in the deployment manifest", async () => {
  await writeInstalledScriptManifest({
    client: {},
    name: "nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
    redact: (value) => value,
  });
  expect(exec).toHaveBeenCalledTimes(1);
  expect(exec.mock.calls[0][1]).toContain("sha256sum");
  expect(exec.mock.calls[0][1]).toContain("nested/hook.sh");
  expect(exec.mock.calls[0][1]).toContain("awk -F");
  expect(exec.mock.calls[0][1]).toContain('mv -- "$manifest_tmp" "/tmp/manifest.tsv"');
  expect(exec.mock.calls[0][1]).not.toContain('>> "/tmp/manifest.tsv"');
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
