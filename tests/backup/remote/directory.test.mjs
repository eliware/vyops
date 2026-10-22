import { jest } from "@jest/globals";
const { inspectRemoteScriptDirectory } = await import("../../../src/backup/remote/directory.mjs");

test("reads the mode of a stable remote script directory", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "2755\n", stderr: "" });
  await expect(inspectRemoteScriptDirectory(exec, {}, "nested/scripts")).resolves.toEqual({
    name: "nested/scripts",
    mode: "2755",
    type: "directory",
  });
  expect(exec.mock.calls[0][1]).toContain("realpath");
});

test.each([
  ["remote command failure", { code: 1, stdout: "", stderr: "denied" }],
  ["invalid mode", { code: 0, stdout: "not-a-mode\n", stderr: "" }],
])("rejects a directory with %s", async (_name, result) => {
  const exec = jest.fn().mockResolvedValue(result);
  await expect(inspectRemoteScriptDirectory(exec, {}, "nested")).rejects.toThrow(
    "remote script directory changed or is not a directory: /config/scripts/nested",
  );
});
