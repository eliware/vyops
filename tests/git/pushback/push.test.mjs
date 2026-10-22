import { jest } from "@jest/globals";
import { pushCommit } from "../../../src/git/pushback/push.mjs";

test("pushes the local commit", async () => {
  const git = jest.fn().mockResolvedValue({ stdout: "" });
  await expect(pushCommit(git, "repo")).resolves.toBeUndefined();
  expect(git).toHaveBeenCalledWith(["push"], "repo");
});

test("adds commit and branch recovery details when push fails", async () => {
  const failure = Object.assign(new Error("push rejected"), { stderr: "remote rejected" });
  const git = jest.fn(async ([command]) => {
    if (command === "push") throw failure;
    if (command === "symbolic-ref") return { stdout: "main\n" };
    return { stdout: "commit-id\n" };
  });
  await expect(pushCommit(git, "repo")).rejects.toMatchObject({
    message: expect.stringContaining(
      "git push failed after local commit commit-id; branch: main; upstream: commit-id",
    ),
    cause: failure,
  });
});
