import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { shouldSkip } from "../src/git.mjs";

const run = promisify(execFile);

async function git(cwd, ...args) {
  await run("git", args, { cwd });
}

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "vyops-git-test-"));
  await git(directory, "init");
  await git(directory, "config", "user.email", "test@example.invalid");
  await git(directory, "config", "user.name", "Test");
  const config = join(directory, "config.boot");
  await writeFile(config, "system {}\n");
  await writeFile(`${config}.manifest.tsv`, "kind\tpath\n");
  await git(directory, "add", "config.boot", "config.boot.manifest.tsv");
  await git(directory, "commit", "-m", "Initial");
  return { directory, config };
}

test("git checks use the config directory instead of the process cwd", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  const outside = await mkdtemp(join(tmpdir(), "vyops-outside-"));
  process.chdir(outside);
  try {
    await git(directory, "commit", "--allow-empty", "-m", "Pushback config directory");
    await expect(shouldSkip(config)).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("shouldSkip is false for changed config", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, "system {\n    host-name changed\n}\n");
    await expect(shouldSkip(config)).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("shouldSkip recognizes an unchanged Pushback commit", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await git(directory, "commit", "--allow-empty", "-m", "Pushback test");
    await expect(shouldSkip(config)).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("shouldSkip accepts a repository-relative config path", async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await git(directory, "commit", "--allow-empty", "-m", "Pushback relative");
    await expect(shouldSkip("config.boot")).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test("shouldSkip checks changed repository-relative config paths", async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, "system {\n    host-name changed\n}\n");
    await expect(shouldSkip("config.boot")).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});
