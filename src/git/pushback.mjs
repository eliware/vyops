import { runGit as runGitDefault } from "./command.mjs";
import { pushFailure } from "./push-failure.mjs";
import { repositoryState } from "./repository/state.mjs";
import { pushbackPaths } from "./pushback-paths.mjs";
import { relativeConfigPath, repositoryRoot } from "./repository/location.mjs";
import { withRepositoryLock } from "./lock.mjs";

export { relativeConfigPath, repositoryRoot };

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
        throw new Error("repository changed during deployment. Refusing to commit.");
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
          "configuration or manifest has staged and unstaged changes. Refusing to overwrite staged content.",
        );
      const { stdout: diff } = await gitRunner(["diff", "HEAD", "--", ...paths], repo);
      if (!diff) return false;
      await beforeCommit(repo);
      if ((await repositoryState(gitRunner, repo, relativePath)) !== initialState)
        throw new Error("repository changed during pushback. Refusing to commit.");
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
