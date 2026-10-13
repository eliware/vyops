import { pushFailure } from "../../src/git/push-failure.mjs";
import { pushBack } from "../../src/git/pushback.mjs";
import { jest } from "@jest/globals";
import {
  createGitMock,
  createGitWorkspace,
  removeGitWorkspace,
} from "../../test-fixtures/git-harness.mjs";

test.each([
  [
    "available",
    async ([command]) => ({ stdout: command === "rev-parse" ? "abc123\n" : "main\n" }),
    "commit abc123; branch: main",
    "remote rejected",
    "push failed",
  ],
  [
    "fallback",
    async () => {
      throw new Error("metadata unavailable");
    },
    "commit unknown; branch: DETACHED; upstream: (none)",
    undefined,
    "push failed",
  ],
  [
    "message fallback",
    async ([command]) => ({ stdout: command === "rev-parse" ? "abc\n" : "main\n" }),
    "commit abc; branch: main",
    undefined,
    "push failed",
  ],
])("reports %s push recovery metadata", async (_name, git, expected, stderr, message) => {
  await expect(
    pushFailure(git, "repo", Object.assign(new Error(message), stderr ? { stderr } : {})),
  ).resolves.toMatchObject({ message: expect.stringContaining(expected) });
});

test("push failure remains clear when repository metadata cannot be read", async () => {
  const { directory, config } = await createGitWorkspace("vyops-push-metadata-");
  let pushed = false;
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
    if (args[0] === "push") {
      pushed = true;
      throw Object.assign(new Error("remote rejected"), { stderr: "remote rejected" });
    }
    if (
      pushed &&
      ((args[0] === "rev-parse" && args[1] === "HEAD") ||
        args[0] === "symbolic-ref" ||
        args.includes("@{u}"))
    )
      throw new Error("metadata unavailable");
  });
  try {
    await expect(pushBack(config, { runGit: git })).rejects.toThrow(
      /git push failed after local commit unknown; branch: DETACHED; upstream: \(none\)/,
    );
  } finally {
    await removeGitWorkspace(directory);
  }
});
