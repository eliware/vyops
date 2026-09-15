export async function pushFailure(git, repo, error) {
  const [commit, branch, upstream] = await Promise.all([
    git(['rev-parse', 'HEAD'], repo).then(result => result.stdout.trim()).catch(() => 'unknown'),
    git(['symbolic-ref', '--quiet', '--short', 'HEAD'], repo).then(result => result.stdout.trim()).catch(() => 'DETACHED'),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo).then(result => result.stdout.trim()).catch(() => '(none)'),
  ]);
  const detail = error.stderr?.trim() || error.message;
  return new Error(`git push failed after local commit ${commit}; branch: ${branch}; upstream: ${upstream}; error: ${detail}; recovery: git push`, { cause: error });
}
