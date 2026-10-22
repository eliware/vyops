import { runGit as runGitDefault } from "./command.mjs";
import { pushbackPaths } from "./pushback-paths.mjs";
import { relativeConfigPath, repositoryRoot } from "./repository/location.mjs";
import { withRepositoryLock } from "./lock.mjs";
import { commitPushback } from "./pushback/commit-push.mjs";

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
    () => commitPushback(gitRunner, { repo, relativePath, paths, expectedState, beforeCommit }),
    force,
  );
}
