import { jest } from "@jest/globals";
import { validateScriptFile } from "../../../src/bundle/script/validation.mjs";

test("reads file contents and mode before validating a script", async () => {
  const fsApi = {
    readFile: jest.fn().mockResolvedValue(Buffer.from("#!/bin/sh\necho ok\n")),
    stat: jest.fn().mockResolvedValue({ mode: 0o100755 }),
  };
  await expect(
    validateScriptFile(fsApi, { file: "/bundle/scripts/hook.sh", name: "hook.sh" }),
  ).resolves.toBeUndefined();
  expect(fsApi.readFile).toHaveBeenCalledWith("/bundle/scripts/hook.sh");
  expect(fsApi.stat).toHaveBeenCalledWith("/bundle/scripts/hook.sh");
});

test("rejects invalid script content after reading the file", async () => {
  const fsApi = {
    readFile: jest.fn().mockResolvedValue(Buffer.from("echo bad\n")),
    stat: jest.fn().mockResolvedValue({ mode: 0o100755 }),
  };
  await expect(
    validateScriptFile(fsApi, { file: "/bundle/scripts/hook.sh", name: "hook.sh" }),
  ).rejects.toThrow("no shebang");
});
