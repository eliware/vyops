import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
import { join } from "node:path";

const readdir = jest.fn();
const readFile = jest.fn();
const stat = jest.fn();
const exec = jest.fn();
const upload = jest.fn();
const { deploymentRemotePaths } = await import("../../../src/deploy/remote/paths.mjs");
const scriptsRoot = deploymentRemotePaths("run-id").scripts;
jest.unstable_mockModule("@eliware/common", () => ({
  fs: { promises: { readdir, readFile, stat } },
  path: (...parts) => join(...parts),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule("node:fs/promises", () => ({ readFile }));
jest.unstable_mockModule("../../../src/ssh.mjs", () => ({ exec, upload }));
jest.unstable_mockModule("../../../src/ssh/exec.mjs", () => ({ exec }));
jest.unstable_mockModule("../../../src/ssh/upload.mjs", () => ({ upload }));
const { installScripts } = await import("../../../src/deploy/script/sync.mjs");
const identity = (value) => value;

test("returns no hook finalizer when the local script tree is absent", async () => {
  readdir.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
  await expect(
    installScripts({}, "/tmp/config.boot", jest.fn(), "run-id", false, identity),
  ).resolves.toBeNull();
  expect(exec).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

test("propagates local script tree errors other than missing directories", async () => {
  readdir.mockRejectedValueOnce(new Error("directory unavailable"));
  await expect(
    installScripts({}, "/tmp/config.boot", jest.fn(), "run-id", false, identity),
  ).rejects.toThrow("directory unavailable");
});

beforeEach(() => {
  jest.clearAllMocks();
  readFile.mockImplementation(async (file) => {
    if (file.endsWith(".deployment.tsv"))
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return Buffer.from("#!/bin/sh\necho ok\n");
  });
  stat.mockResolvedValue({ mode: 0o100755 });
  exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  upload.mockResolvedValue(undefined);
});

test("stages, validates, installs, and finalizes a script tree", async () => {
  readdir.mockResolvedValueOnce([
    { name: "health.sh", isFile: () => true, isDirectory: () => false },
  ]);
  const debug = jest.fn();
  const finalize = await installScripts({}, "/tmp/config.boot", debug, "run-id", true, identity);
  expect(upload).toHaveBeenCalledWith(
    {},
    join("/tmp", "scripts", "health.sh"),
    `${scriptsRoot}/health.sh`,
    0o755,
  );
  expect(exec.mock.calls.some(([, command]) => command.includes("sha256sum"))).toBe(true);
  await finalize(true, {});
  expect(exec.mock.calls.at(-1)[1]).toContain("rm -rf");
  expect(exec.mock.calls[1][1]).toContain(
    "printf '%s\\n' \"kind\\tpath\\tpreexisting\\told_mode\\told_sha256\\told_type\\tnew_mode\\tnew_sha256\\tnew_type\"",
  );
  expect(debug).toHaveBeenCalledWith("installed script: health.sh");
});

test("rejects control characters before uploading a script", async () => {
  readdir.mockResolvedValueOnce([
    { name: "bad\nname.sh", isFile: () => true, isDirectory: () => false },
  ]);
  await expect(
    installScripts({}, "/tmp/config.boot", jest.fn(), "run-id", false, identity),
  ).rejects.toThrow("script path is invalid");
  expect(upload).not.toHaveBeenCalled();
});

test("continues when live inspection reports a missing command environment", async () => {
  readdir.mockResolvedValueOnce([
    { name: "health.sh", isFile: () => true, isDirectory: () => false },
  ]);
  exec.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
  const finalize = await installScripts(
    {},
    "/tmp/config.boot",
    jest.fn(),
    "run-id",
    false,
    identity,
  );
  expect(upload).toHaveBeenCalled();
  await finalize(true, {});
});

test("creates and uploads nested script directories", async () => {
  readdir.mockResolvedValueOnce([
    { name: "health/check.sh", isFile: () => true, isDirectory: () => false },
  ]);
  const finalize = await installScripts(
    {},
    "/tmp/config.boot",
    jest.fn(),
    "run-id",
    false,
    identity,
  );
  expect(exec.mock.calls.some(([, command]) => command.includes(`${scriptsRoot}/health`))).toBe(
    true,
  );
  expect(upload).toHaveBeenCalledWith(
    {},
    join("/tmp", "scripts", "health", "check.sh"),
    `${scriptsRoot}/health/check.sh`,
    0o755,
  );
  await finalize(true, {});
});
