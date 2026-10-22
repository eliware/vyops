import { pushFailure } from "../push-failure.mjs";

export async function pushCommit(gitRunner, repo) {
  try {
    await gitRunner(["push"], repo);
  } catch (error) {
    throw await pushFailure(gitRunner, repo, error);
  }
}
