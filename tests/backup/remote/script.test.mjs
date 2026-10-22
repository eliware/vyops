import { jest } from "@jest/globals";

const exec = jest.fn();
jest.unstable_mockModule("../../../src/ssh.mjs", () => ({
  close: jest.fn(),
  connect: jest.fn(),
  download: jest.fn(),
  exec,
}));
const { validateRemoteScript } = await import("../../../src/backup/remote/script.mjs");

beforeEach(() => exec.mockReset());

test("accepts a stable regular remote script", async () => {
  exec.mockResolvedValue({
    code: 0,
    stdout: `755\t${"a".repeat(64)}\tregular file\n`,
    stderr: "",
  });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).resolves.toEqual({
    mode: "755",
    sha256: "a".repeat(64),
    type: "regular file",
  });
  expect(exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("realpath"));
});

test("rejects invalid remote script metadata", async () => {
  exec.mockResolvedValue({ code: 0, stdout: "755\tbad\tregular file\n", stderr: "" });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).rejects.toThrow(
    "remote script metadata is invalid: /config/scripts/hook.sh",
  );
});

test("rejects missing remote script metadata", async () => {
  exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).rejects.toThrow(
    "remote script metadata is invalid: /config/scripts/hook.sh",
  );
});

test("rejects a remote script whose metadata check fails", async () => {
  exec.mockResolvedValue({ code: 1, stdout: "", stderr: "changed" });
  await expect(validateRemoteScript(exec, {}, "/config/scripts/hook.sh")).rejects.toThrow(
    "remote script changed or is not a regular file: /config/scripts/hook.sh",
  );
});
