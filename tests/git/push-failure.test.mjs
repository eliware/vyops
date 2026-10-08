import { pushFailure } from "../../src/git/push-failure.mjs";
import { pushBack } from "../../src/git/pushback.mjs";
import { jest } from "@jest/globals";
import {
  createGitMock,
  createGitWorkspace,
  removeGitWorkspace,
} from "../../test-fixtures/git-harness.mjs";

test("reports available push recovery metadata", async () => {
  const git = async ([command]) => ({ stdout: command === "rev-parse" ? "abc123\n" : "main\n" });
  await expect(
    pushFailure(
      git,
      "repo",
      Object.assign(new Error("push failed"), { stderr: "remote rejected" }),
    ),
  ).resolves.toMatchObject({ message: expect.stringContaining("commit abc123; branch: main") });
});

test("uses safe fallbacks when push recovery metadata is unavailable", async () => {
  const git = async () => {
    throw new Error("metadata unavailable");
  };
  await expect(pushFailure(git, "repo", new Error("push failed"))).resolves.toMatchObject({
    message: expect.stringContaining("commit unknown; branch: DETACHED; upstream: (none)"),
  });
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
