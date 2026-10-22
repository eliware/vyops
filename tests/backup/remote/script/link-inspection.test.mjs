import { jest } from "@jest/globals";
import { inspectRemoteScriptLinks } from "../../../../src/backup/remote/script/link-inspection.mjs";

test("checks the remote scripts root and nested links", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await inspectRemoteScriptLinks(exec, {});
  expect(exec).toHaveBeenCalledWith({}, expect.stringContaining("if [ -L /config/scripts ]"));
  expect(exec.mock.calls[0][1]).toContain("find -P /config/scripts -type l -print0");
});

test.each([
  [{ code: 1, stderr: "denied" }, "could not inspect remote scripts: denied"],
  [{ code: 1, stderr: "", stdout: "find failed" }, "could not inspect remote scripts: find failed"],
  [{ code: 0, stdout: "/config/scripts\0" }, "remote script symlink rejected: /config/scripts"],
  [
    { code: 0, stdout: "/config/scripts/link\0" },
    "remote script symlink rejected: /config/scripts/link",
  ],
])("rejects unsafe or unavailable remote link inspection", async (result, message) => {
  await expect(inspectRemoteScriptLinks(jest.fn().mockResolvedValue(result), {})).rejects.toThrow(
    message,
  );
});
