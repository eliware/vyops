import { jest } from "@jest/globals";
import { inspectRemoteScriptDirectories } from "../../../src/backup/remote/directories.mjs";

test("inspects unique parent directories in natural order", async () => {
  const exec = jest.fn().mockImplementation(async (_client, command) => ({
    code: 0,
    stdout: command.includes("scripts/dir10") ? "755\n" : "750\n",
    stderr: "",
  }));
  const files = [{ name: "dir10/item" }, { name: "dir2/sub/item" }, { name: "dir2/other" }];
  await expect(inspectRemoteScriptDirectories(exec, {}, files)).resolves.toEqual([
    { name: "dir2", mode: "750", type: "directory" },
    { name: "dir2/sub", mode: "750", type: "directory" },
    { name: "dir10", mode: "755", type: "directory" },
  ]);
  expect(exec).toHaveBeenCalledTimes(3);
});

test("returns no directories when every script is at the root", async () => {
  const exec = jest.fn();
  await expect(inspectRemoteScriptDirectories(exec, {}, [{ name: "hook.sh" }])).resolves.toEqual(
    [],
  );
  expect(exec).not.toHaveBeenCalled();
});
