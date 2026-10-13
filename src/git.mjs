import { runGit } from "./git/command.mjs";
import { repositoryState } from "./git/repository-state.mjs";
import { deploymentPaths } from "./git/deployment-paths.mjs";
import { pushBack } from "./git/pushback.mjs";
import { repositoryRoot, relativeConfigPath } from "./git/repository-location.mjs";

export { pushBack };

export async function repositorySnapshot(config, gitRunner = runGit) {
  const repo = await repositoryRoot(config, gitRunner);
  if (!repo) return null;
  const configPath = await relativeConfigPath(repo, config);
  return { repo, state: await repositoryState(gitRunner, repo, configPath) };
}

export async function shouldSkip(config, gitRunner = runGit) {
  const repo = await repositoryRoot(config, gitRunner);
  if (!repo) return false;
  const relativePath = await relativeConfigPath(repo, config);
  const { stdout: status } = await gitRunner(
    ["status", "--porcelain", "--", ...deploymentPaths(relativePath)],
    repo,
  );
  if (status.trim()) return false;
  const { stdout: subject } = await gitRunner(["log", "-1", "--format=%s"], repo);
  return subject.trim().startsWith("Pushback ");
}
