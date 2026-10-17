import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
const { repositorySnapshot, shouldSkip, pushBack } = await import("../../../src/git.mjs");
const { repositoryState } = await import("../../../src/git/repository/state.mjs");
const { createGitMock, createGitWorkspace, removeGitWorkspace } =
  await import("../../../test-fixtures/git-harness.mjs");

test("repository snapshots identify detached HEAD state", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "symbolic-ref") throw new Error("detached");
    if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") throw new Error("no upstream");
  });
  try {
    await expect(repositorySnapshot(config, git)).resolves.toMatchObject({
      state: expect.stringContaining("\nDETACHED\n(none)\n"),
    });
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("handles absolute config paths with normalized separators", async () => {
  const { directory, config } = await createGitWorkspace();
  const git = createGitMock(jest, directory);
  try {
    await expect(shouldSkip(config.replaceAll("\\", "/"), git)).resolves.toBe(false);
    await expect(pushBack(config.replaceAll("\\", "/"), { runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("pushBack handles a changed repository-relative config path", async () => {
  const { directory } = await createGitWorkspace("relative-", process.cwd());
  const git = createGitMock(jest, directory, async (args) => {
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
  });
  try {
    await expect(pushBack("config.boot", { runGit: git })).resolves.toBe(true);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("Git integration is optional outside a repository", async () => {
  const { directory, config } = await createGitWorkspace("vyops-no-git-");
  const git = createGitMock(jest, directory, async () => {
    throw Object.assign(new Error("not a git repository"), {
      stderr: "fatal: not a git repository",
    });
  });
  try {
    await expect(shouldSkip(config, git)).resolves.toBe(false);
    await expect(repositorySnapshot(config, git)).resolves.toBeNull();
    await expect(pushBack(config, { runGit: git })).resolves.toBe(false);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("Git integration propagates unexpected repository errors", async () => {
  const { directory, config } = await createGitWorkspace("vyops-invalid-git-");
  const git = createGitMock(jest, directory, async () => {
    throw new Error("unexpected repository error");
  });
  try {
    await expect(shouldSkip(config, git)).rejects.toThrow("unexpected repository error");
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("joins Git state fields into a snapshot", async () => {
  const git = jest.fn(async ([command]) => ({ stdout: command === "rev-parse" ? "head\n" : "" }));
  await expect(repositoryState(git, "repo", "config.boot")).resolves.toContain("head");
  expect(git).toHaveBeenCalledTimes(5);
});

test.each([
  [
    "deployment state",
    (directory) => ({
      git: createGitMock(jest, directory),
      options: { expectedState: { repo: directory, state: "stale" } },
    }),
    "repository changed during deployment. Refusing to commit.",
  ],
  [
    "unrelated file changes",
    (directory) => {
      let changed = false;
      return {
        git: createGitMock(jest, directory, async (args) => {
          if (changed && args[0] === "status" && args[2] === "--untracked-files=all")
            return { stdout: " M other.txt\n" };
          if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
        }),
        options: {
          beforeCommit: async () => {
            changed = true;
          },
        },
      };
    },
    "repository changed during pushback. Refusing to commit.",
  ],
])("pushBack refuses changes from %s", async (_case, setup, message) => {
  const { directory, config } = await createGitWorkspace();
  const { git, options } = setup(directory);
  try {
    await expect(pushBack(config, { ...options, runGit: git })).rejects.toThrow(message);
  } finally {
    await removeGitWorkspace(directory);
  }
});

test("pushBack refuses a repository changed after diff calculation", async () => {
  const { directory, config } = await createGitWorkspace();
  let changed = false;
  const git = createGitMock(jest, directory, async (args) => {
    if (changed && args[0] === "status" && args[2] === "--untracked-files=all")
      return { stdout: "?? created-during-pushback.txt\n" };
    if (args[0] === "diff" && args[1] === "HEAD") return { stdout: "changed config" };
  });
  try {
    await expect(
      pushBack(config, {
        runGit: git,
        beforeCommit: async () => {
          changed = true;
        },
      }),
    ).rejects.toThrow("repository changed during pushback. Refusing to commit.");
  } finally {
    await removeGitWorkspace(directory);
  }
});
