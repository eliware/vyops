import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repositoryState } from "./git/repository-state.mjs";
import { repositoryRoot, relativeConfigPath, pushBack } from "./git/pushback.mjs";

const run = promisify(execFile);
async function git(args, cwd) {
  return run("git", args, { cwd, encoding: "utf8" });
}

export { pushBack };

export async function repositorySnapshot(config) {
  const repo = await repositoryRoot(config);
  if (!repo) return null;
  const configPath = await relativeConfigPath(repo, config);
  return { repo, state: await repositoryState(git, repo, configPath) };
}

export async function shouldSkip(config) {
  const repo = await repositoryRoot(config);
  if (!repo) return false;
  const relativePath = await relativeConfigPath(repo, config);
  const { stdout: status } = await git(["status", "--porcelain", "--", relativePath], repo);
  if (status.trim()) return false;
  const { stdout: subject } = await git(["log", "-1", "--format=%s"], repo);
  return subject.trim().startsWith("Pushback ");
}
