import { promisify } from "node:util";
import { jest } from "@jest/globals";

const execute = jest.fn().mockResolvedValue({ stdout: "mock output", stderr: "" });
const execFile = jest.fn();
execFile[promisify.custom] = execute;
await jest.unstable_mockModule("node:child_process", () => ({ execFile }));
const { runGit } = await import("../../src/git/command.mjs");

test("runs Git through the mocked process API", async () => {
  await expect(runGit(["status", "--short"], "repo")).resolves.toEqual({
    stdout: "mock output",
    stderr: "",
  });
  expect(execute).toHaveBeenCalledWith("git", ["status", "--short"], {
    cwd: "repo",
    encoding: "utf8",
  });
});
