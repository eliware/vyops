import { jest } from "@jest/globals";

const exec = jest.fn();
const upload = jest.fn();
jest.unstable_mockModule("../../src/ssh/exec.mjs", () => ({ exec }));
jest.unstable_mockModule("../../src/ssh/upload.mjs", () => ({ upload }));
const { binaryArchitecturePattern, uploadStagedScript } =
  await import("../../src/deploy/upload-staged-script.mjs");

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

test("uses router paths without creating a parent for top-level scripts", async () => {
  await uploadStagedScript({ ...options, parent: "." });
  expect(exec).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith({}, options.local, options.remote, 0o755);
});

test("reports nested directory setup failures before upload", async () => {
  exec.mockResolvedValueOnce({ code: 1, stderr: "permission denied" });
  await expect(uploadStagedScript(options)).rejects.toThrow(
    /script upload directory setup failed \(nested[\\/]hook\.sh\): permission denied/,
  );
  expect(upload).not.toHaveBeenCalled();
});

test("uses binary validation without text line-ending checks", async () => {
  await uploadStagedScript({
    ...options,
    executable: 0,
    binary: true,
    verifyBinaries: true,
    localHash: "hash",
  });
  const command = exec.mock.calls.at(-1)[1];
  expect(command).toContain("uname -m");
  expect(command).toContain("x86_64:.*ELF.*x86-64.*");
  expect(command).toContain("aarch64:.*ELF.*ARM aarch64.*");
  expect(command).toContain("armv7l:.*ELF.*ARM(,|$).*");
  expect(command).toContain("sha256sum");
  expect(command).not.toContain("grep -q");
  expect(command).not.toContain("test -x");
});

test("checks the remote architecture without a hash when binary verification is disabled", async () => {
  await uploadStagedScript({ ...options, binary: true, verifyBinaries: false });
  const command = exec.mock.calls.at(-1)[1];
  expect(command).toContain("armv7l:.*ELF.*ARM(,|$).*");
  expect(command).not.toContain("sha256sum");
});

test("uses remote standard output when parent setup fails without an error message", async () => {
  exec.mockResolvedValueOnce({ code: 1, stderr: "", stdout: "denied" });
  await expect(uploadStagedScript(options)).rejects.toThrow("script upload directory setup failed");
  await expect(upload).not.toHaveBeenCalled();
});

test("uses the default error when remote validation returns no output", async () => {
  exec
    .mockResolvedValueOnce({ code: 0 })
    .mockResolvedValueOnce({ code: 1, stderr: "", stdout: "" });
  await expect(uploadStagedScript(options)).rejects.toThrow(
    "remote script preflight failed (nested/hook.sh): mode or line-ending check failed",
  );
});

test.each([
  [
    "accepts x86-64 descriptions with trailing details",
    "x86_64",
    "ELF 64-bit LSB x86-64, version 1",
    true,
  ],
  [
    "accepts AArch64 descriptions with trailing details",
    "aarch64",
    "ELF 64-bit LSB ARM aarch64, version 1",
    true,
  ],
  [
    "accepts ARMv7 descriptions with trailing details",
    "armv7l",
    "ELF 32-bit LSB ARM, EABI5 version 1",
    true,
  ],
  [
    "rejects AArch64 descriptions on ARMv7",
    "armv7l",
    "ELF 64-bit LSB ARM aarch64, version 1",
    false,
  ],
  [
    "rejects ARMv7 descriptions on AArch64",
    "aarch64",
    "ELF 32-bit LSB ARM, EABI5 version 1",
    false,
  ],
  ["rejects x86-64 descriptions on AArch64", "aarch64", "ELF 64-bit LSB x86-64, version 1", false],
  [
    "rejects AArch64 descriptions on x86-64",
    "x86_64",
    "ELF 64-bit LSB ARM aarch64, version 1",
    false,
  ],
  ["rejects x86-64 descriptions on ARMv7", "armv7l", "ELF 64-bit LSB x86-64, version 1", false],
  ["rejects ARMv7 descriptions on x86-64", "x86_64", "ELF 32-bit LSB ARM, EABI5 version 1", false],
])("%s", (_name, machine, description, expected) => {
  expect(new RegExp(binaryArchitecturePattern).test(`${machine}:${description}`)).toBe(expected);
});
