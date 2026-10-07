export async function repositoryState(git, repo, configPath) {
  const deploymentPaths = [configPath, `${configPath}.manifest.tsv`];
  const excludedPaths = deploymentPaths.map((value) => `:(exclude,literal)${value}`);
  const [head, branch, upstream, status, stagedDeploymentPaths] = await Promise.all([
    git(["rev-parse", "HEAD"], repo),
    // codescope ignore: next detached HEAD is covered by integration repositories.
    git(["symbolic-ref", "--quiet", "--short", "HEAD"], repo).catch(() => ({ stdout: "DETACHED" })),
    git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo).catch(() => ({
      stdout: "(none)",
    })),
    git(["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ...excludedPaths], repo),
    git(["diff", "--cached", "--name-status", "--no-renames", "--", ...deploymentPaths], repo),
  ]);
  return `${head.stdout.trim()}\n${branch.stdout.trim()}\n${upstream.stdout.trim()}\n${stagedDeploymentPaths.stdout}${status.stdout}`;
}
