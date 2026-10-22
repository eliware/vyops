import { repositoryState } from "../repository/state.mjs";
import { formatRepositorySnapshot } from "../repository/snapshot.mjs";
import { pushCommit } from "./push.mjs";

export async function commitPushback(
  gitRunner,
  { repo, relativePath, paths, expectedState, beforeCommit },
) {
  const initialState = formatRepositorySnapshot(
    await repositoryState(gitRunner, repo, relativePath),
  );
  if (expectedState && (expectedState.repo !== repo || initialState !== expectedState.state)) {
    throw new Error("repository changed during deployment. Refusing to commit.");
  }
  const { stdout: status } = await gitRunner(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...paths],
    repo,
  );
  const hasStagedAndUnstagedChanges = status
    .split("\0")
    .some((entry) => entry.length > 2 && entry[0] !== " " && entry[0] !== "?" && entry[1] !== " ");
  if (hasStagedAndUnstagedChanges)
    throw new Error(
      "configuration or manifest has staged and unstaged changes. Refusing to overwrite staged content.",
    );
  const { stdout: diff } = await gitRunner(["diff", "HEAD", "--", ...paths], repo);
  if (!diff) return false;
  await beforeCommit(repo);
  if (
    formatRepositorySnapshot(await repositoryState(gitRunner, repo, relativePath)) !== initialState
  )
    throw new Error("repository changed during pushback. Refusing to commit.");
  await gitRunner(["add", "--", ...paths], repo);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  await gitRunner(["commit", "--only", "-m", `Pushback ${timestamp}`, "--", ...paths], repo);
  await pushCommit(gitRunner, repo);
  return true;
}
