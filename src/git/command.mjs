import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function runGit(args, cwd) {
  return run("git", args, { cwd, encoding: "utf8" });
}
