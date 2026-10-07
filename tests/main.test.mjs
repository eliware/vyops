import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageJson from "../package.json" with { type: "json" };
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import "../src/main.mjs";
import { backup } from "../src/backup.mjs";
import { deploy } from "../src/deploy.mjs";
import { jest } from "@jest/globals";
import { setupMainHarness } from "../test-fixtures/main-harness.mjs";

let cli;
let args;
beforeAll(async () => {
  cli = await setupMainHarness(jest);
});

beforeEach(() => {
  jest.clearAllMocks();
  process.exitCode = 0;
  args = { command: "preflight", config: "config.boot", noPushback: true };
  cli.parseArgs.mockImplementation(() => ({ ...args }));
  cli.runPreflight.mockResolvedValue({ target: "vyos@router", scripts: [] });
  cli.shouldSkip.mockResolvedValue(false);
  cli.repositorySnapshot.mockResolvedValue("snapshot");
  cli.pushBack.mockResolvedValue(false);
});

const run = promisify(execFile);
const entrypoint = join(process.cwd(), "bin", "vyops");
const binEntrypoint = entrypoint;

test("prints help and version without external effects", async () => {
  const help = await run(process.execPath, [entrypoint, "--help"]);
  expect(help.stdout).toMatch(/Usage:/);

  const version = await run(process.execPath, [entrypoint, "--version"]);
  expect(version.stdout.trim()).toBe(packageJson.version);
});

test("packaged bin entrypoint invokes the CLI", async () => {
  const result =
    process.platform === "win32"
      ? await run(process.execPath, [binEntrypoint, "--help"])
      : await run(binEntrypoint, ["--help"]);
  expect(result.stdout).toMatch(/Usage:/);
});

test("preflight validates config without connecting or pushing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-test-"));
  const config = join(directory, "config.boot");
  await writeFile(
    config,
    "system {\n    host-name test\n    login {\n        user vyos {\n        }\n    }\n}\n",
  );
  try {
    const result = await run(process.execPath, [entrypoint, "preflight", config]);
    expect(result.stdout).toContain("Preflight successful");
    expect(result.stderr).toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid config exits nonzero without attempting deployment", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-test-"));
  const config = join(directory, "config.boot");
  await writeFile(config, "system {\n    host-name broken\n");
  try {
    await expect(run(process.execPath, [entrypoint, "preflight", config])).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("unbalanced braces"),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid invocation exits nonzero", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-test-"));
  const config = join(directory, "config.boot");
  await writeFile(config, "system {\n    host-name test\n}\n");
  try {
    await expect(
      run(process.execPath, [entrypoint, "preflight", config, "extra"]),
    ).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining("Usage:") });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("covers help, version, backup, and preflight branches", async () => {
  args.help = true;
  await cli.runCli();
  expect(cli.log.info).toHaveBeenCalledWith(cli.usage);
  args = { version: true };
  const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  await cli.runCli();
  expect(write).toHaveBeenCalledWith(`${packageJson.version}\n`);
  write.mockRestore();
  args = { command: "backup" };
  await cli.runCli();
  expect(cli.runBackup).toHaveBeenCalled();
  args = { command: "preflight" };
  await cli.runCli();
  expect(cli.runPreflight).toHaveBeenCalled();
});

test("reads passwords from stdin and handles empty input", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, "stdin");
  Object.defineProperty(process, "stdin", {
    configurable: true,
    value: Readable.from([Buffer.from("secret\n")]),
  });
  args = { command: "backup", passwordStdin: true };
  try {
    await cli.runCli();
    expect(cli.log.error).not.toHaveBeenCalled();
    expect(cli.runBackup.mock.calls[0][0].password).toBe("secret");
    Object.defineProperty(process, "stdin", {
      configurable: true,
      value: Readable.from([]),
    });
    await cli.runCli();
    expect(cli.log.error).toHaveBeenCalledWith("password-stdin received an empty password");
  } finally {
    Object.defineProperty(process, "stdin", descriptor);
  }
});

test("runs release and pushback after preflight", async () => {
  args = { command: "release", config: "config.boot", noPushback: false };
  cli.pushBack.mockResolvedValue(true);
  await cli.runCli();
  expect(cli.prepareRelease).toHaveBeenCalled();
  expect(cli.repositorySnapshot).toHaveBeenCalledWith("config.boot");
  expect(cli.deploy).toHaveBeenCalled();
  expect(cli.log.info).toHaveBeenCalledWith(
    expect.stringContaining("Pushback committed and pushed"),
  );
});

test("skips unchanged releases and deploys other commands", async () => {
  args = { command: "release", config: "config.boot", noPushback: false };
  cli.shouldSkip.mockResolvedValue(true);
  await cli.runCli();
  expect(cli.deploy).not.toHaveBeenCalled();
  args = { command: "other", config: "config.boot", noPushback: true };
  await cli.runCli();
  expect(cli.readAndValidateConfig).toHaveBeenCalledWith("config.boot");
  expect(cli.deploy).toHaveBeenCalled();
});

test("handles argument errors and removes handlers", async () => {
  cli.parseArgs.mockImplementation(() => {
    throw new Error("invalid arguments");
  });
  await cli.runCli();
  expect(cli.log.error).toHaveBeenCalledWith("invalid arguments");
  expect(cli.signals.removeHandlers).toHaveBeenCalled();
  expect(cli.errors.removeHandlers).toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});

test("runs both registered shutdown actions", async () => {
  await cli.signals.shutdownHook();
  expect(cli.closeAll).toHaveBeenCalled();
  expect(cli.cleanupActiveDeployments).toHaveBeenCalled();
});

const target = process.env.VYOPS_LIVE_TARGET;
const destination = process.env.VYOPS_LIVE_BACKUP_DEST;
const password = process.env.VYOPS_LIVE_PASSWORD;
const liveTest = target && destination ? test : test.skip;

liveTest("backs up the configured live router without mutation", async () => {
  await expect(backup({ target, config: destination, password })).resolves.toBe(0);
});

const releaseTarget = process.env.VYOPS_LIVE_RELEASE_TARGET;
const releaseConfig = process.env.VYOPS_LIVE_RELEASE_CONFIG;
const releasePassword = process.env.VYOPS_LIVE_RELEASE_PASSWORD;
const releaseConfirmed = process.env.VYOPS_LIVE_RELEASE_CONFIRM === "I_UNDERSTAND";
const releaseTest = releaseTarget && releaseConfig && releaseConfirmed ? test : test.skip;

releaseTest("deploys and verifies the explicitly authorized live router", async () => {
  await expect(
    deploy({
      target: releaseTarget,
      config: releaseConfig,
      password: releasePassword,
      verify: true,
      noHooks: false,
    }),
  ).resolves.toBe(0);
});
