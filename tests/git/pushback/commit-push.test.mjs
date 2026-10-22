import { jest } from "@jest/globals";

const { commitPushback } = await import("../../../src/git/pushback/commit-push.mjs");

function gitMock({
  diff = "changed",
  transactionStatus = "",
  repositoryStatus = "",
  changeRepositoryStatus = false,
} = {}) {
  let repositoryStatusCalls = 0;
  return jest.fn(async ([command, ...args]) => {
    if (command === "rev-parse" && args[0] === "HEAD") return { stdout: "head\n" };
    if (command === "symbolic-ref") return { stdout: "main\n" };
    if (command === "rev-parse") return { stdout: "origin/main\n" };
    if (command === "status") {
      if (args[1] === "-z") return { stdout: transactionStatus };
      repositoryStatusCalls += 1;
      return {
        stdout:
          changeRepositoryStatus && repositoryStatusCalls > 1 ? " M config.boot" : repositoryStatus,
      };
    }
    if (command === "diff" && args[0] === "--cached") return { stdout: "" };
    if (command === "diff" && args[0] === "HEAD") return { stdout: diff };
    return { stdout: "" };
  });
}

const paths = ["config.boot", "config.boot.manifest.tsv"];
const parameters = { repo: "repo", relativePath: "config.boot", paths };

test("returns false when the selected files have no diff", async () => {
  const git = gitMock({ diff: "" });
  const beforeCommit = jest.fn();
  await expect(commitPushback(git, { ...parameters, beforeCommit })).resolves.toBe(false);
  expect(beforeCommit).not.toHaveBeenCalled();
  expect(git.mock.calls.some(([args]) => args[0] === "commit" || args[0] === "push")).toBe(false);
});

test("commits a selected untracked deployment file", async () => {
  const git = gitMock({ diff: "", transactionStatus: "?? config.boot.deployment.tsv\0" });
  await expect(commitPushback(git, { ...parameters, beforeCommit: jest.fn() })).resolves.toBe(true);
  expect(git).toHaveBeenCalledWith(["add", "--", ...paths], "repo");
  expect(git.mock.calls.some(([args]) => args[0] === "commit")).toBe(true);
});

test("commits and pushes selected files after the pre-commit action", async () => {
  const git = gitMock();
  const beforeCommit = jest.fn();
  await expect(commitPushback(git, { ...parameters, beforeCommit })).resolves.toBe(true);
  expect(beforeCommit).toHaveBeenCalledWith("repo");
  expect(git).toHaveBeenCalledWith(["add", "--", ...paths], "repo");
  expect(git.mock.calls.some(([args]) => args[0] === "commit")).toBe(true);
  expect(git).toHaveBeenLastCalledWith(["push"], "repo");
});

test("rejects a stale deployment snapshot before staging files", async () => {
  const git = gitMock();
  await expect(
    commitPushback(git, {
      ...parameters,
      expectedState: { repo: "repo", state: "stale" },
      beforeCommit: jest.fn(),
    }),
  ).rejects.toThrow("repository changed during deployment. Refusing to commit.");
  expect(git.mock.calls.some(([args]) => args[0] === "add")).toBe(false);
});

test("rejects a repository change during the pre-commit action", async () => {
  const git = gitMock({ changeRepositoryStatus: true });
  await expect(commitPushback(git, { ...parameters, beforeCommit: jest.fn() })).rejects.toThrow(
    "repository changed during pushback. Refusing to commit.",
  );
  expect(git.mock.calls.some(([args]) => args[0] === "add")).toBe(false);
});

test("preserves staged content when the worktree also changed", async () => {
  const git = gitMock({ transactionStatus: "MM config.boot\0" });
  await expect(commitPushback(git, { ...parameters, beforeCommit: jest.fn() })).rejects.toThrow(
    "configuration or manifest has staged and unstaged changes. Refusing to overwrite staged content.",
  );
  expect(git.mock.calls.some(([args]) => args[0] === "add")).toBe(false);
});
