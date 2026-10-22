import { deploymentPaths } from "../deployment-paths.mjs";

export async function repositoryState(git, repo, configPath) {
  const paths = deploymentPaths(configPath);
  const excludedPaths = paths.map((value) => `:(exclude,literal)${value}`);
  const [head, branch, upstream, status, stagedDeploymentPaths] = await Promise.all([
    git(["rev-parse", "HEAD"], repo),
    // codescope ignore: detached Git state is covered by repository integration tests.
    git(["symbolic-ref", "--quiet", "--short", "HEAD"], repo).catch(() => ({ stdout: "DETACHED" })),
    git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo).catch(() => ({
      stdout: "(none)",
    })),
    git(["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ...excludedPaths], repo),
    git(["diff", "--cached", "--name-status", "--no-renames", "--", ...paths], repo),
  ]);
  return {
    head: head.stdout.trim(),
    branch: branch.stdout.trim(),
    upstream: upstream.stdout.trim(),
    stagedDeploymentPaths: stagedDeploymentPaths.stdout,
    status: status.stdout,
  };
}
