import { jest } from "@jest/globals";

const exec = jest.fn();
const upload = jest.fn();
jest.unstable_mockModule("../../src/ssh/exec.mjs", () => ({ exec }));
jest.unstable_mockModule("../../src/ssh/upload.mjs", () => ({ upload }));
const { uploadStagedScript } = await import("../../src/deploy/upload-staged-script.mjs");

const options = {
  client: {},
  name: "nested/hook.sh",
  local: "/bundle/scripts/nested/hook.sh",
  remote: "/tmp/scripts/nested/hook.sh",
  remoteDir: "/tmp/scripts",
  parent: "nested",
  mode: 0o755,
  executable: 1,
  binary: false,
  localHash: null,
  verifyBinaries: false,
  redact: (text) => text,
};

beforeEach(() => {
  exec.mockReset().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  upload.mockReset().mockResolvedValue(undefined);
});

test("creates remote parents, uploads, and checks text scripts", async () => {
  await uploadStagedScript(options);
  expect(exec).toHaveBeenNthCalledWith(1, {}, 'mkdir -p "/tmp/scripts/nested"');
  expect(upload).toHaveBeenCalledWith({}, options.local, options.remote, 0o755);
  expect(exec.mock.calls[1][1]).toContain("grep -q");
  expect(exec.mock.calls[1][1]).toContain("test -x");
});

test("reports remote file checks that fail", async () => {
  exec.mockResolvedValueOnce({ code: 0 }).mockResolvedValueOnce({ code: 1, stderr: "invalid" });
  await expect(uploadStagedScript(options)).rejects.toThrow(
    "remote script preflight failed (nested/hook.sh): invalid",
  );
});
