import { promises as fs } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { path } from "@eliware/common";
import { runGit as runGitDefault } from "./command.mjs";
import { pushFailure } from "./push-failure.mjs";
import { repositoryState } from "./repository-state.mjs";
import { pushbackPaths } from "./pushback-paths.mjs";
import { withRepositoryLock } from "./lock.mjs";

const configDirectory = (config) => path(config, "..");

export async function relativeConfigPath(repo, config) {
  const [canonicalRepo, canonicalConfig] = await Promise.all([
    fs.realpath(repo),
    fs.realpath(resolve(config)),
  ]);
  const relativePath = relative(canonicalRepo, canonicalConfig);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("configuration path is outside the Git repository");
  }
  return relativePath;
}

export async function repositoryRoot(config, gitRunner = runGitDefault) {
  try {
    const { stdout } = await gitRunner(["rev-parse", "--show-toplevel"], configDirectory(config));
    return stdout.trim();
  } catch (error) {
    if (error.stderr?.includes("not a git repository")) return null;
    throw error;
  }
}

export async function pushBack(
  config,
  { force = false, expectedState, beforeCommit = async () => {}, runGit = runGitDefault } = {},
) {
  const gitRunner = runGit;
  const repo = await repositoryRoot(config, gitRunner);
  if (!repo) return false;
  const relativePath = await relativeConfigPath(repo, config);
  const paths = await pushbackPaths(gitRunner, repo, relativePath);
  return withRepositoryLock(
    repo,
    async () => {
      const initialState = await repositoryState(gitRunner, repo, relativePath);
      if (expectedState && (expectedState.repo !== repo || initialState !== expectedState.state)) {
        throw new Error("repository changed during deployment; refusing to commit");
      }
      const { stdout: status } = await gitRunner(
        ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...paths],
        repo,
      );
      const hasStagedAndUnstagedChanges = status
        .split("\0")
        .some(
          (entry) => entry.length > 2 && entry[0] !== " " && entry[0] !== "?" && entry[1] !== " ",
        );
      if (hasStagedAndUnstagedChanges)
        throw new Error(
          "configuration or manifest has staged and unstaged changes; refusing to overwrite staged content",
        );
      const { stdout: diff } = await gitRunner(["diff", "HEAD", "--", ...paths], repo);
      if (!diff) return false;
      await beforeCommit(repo);
      if ((await repositoryState(gitRunner, repo, relativePath)) !== initialState)
        throw new Error("repository changed during pushback; refusing to commit");
      await gitRunner(["add", "--", ...paths], repo);
      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      await gitRunner(["commit", "--only", "-m", `Pushback ${timestamp}`, "--", ...paths], repo);
      try {
        await gitRunner(["push"], repo);
      } catch (error) {
        throw await pushFailure(gitRunner, repo, error);
      }
      return true;
    },
    force,
  );
}
