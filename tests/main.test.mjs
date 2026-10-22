import { jest } from "@jest/globals";
import packageJson from "../package.json" with { type: "json" };
import "../src/main.mjs";
const { setupMainHarness } = await import("../test-fixtures/main-harness.mjs");

let cli;
let args;
beforeAll(async () => {
  cli = await setupMainHarness(jest);
});

beforeEach(() => {
  jest.clearAllMocks();
  process.exitCode = 0;
  cli.log.level = "info";
  args = { command: "preflight", config: "config.boot", noPushback: true };
  cli.parseArgs.mockImplementation(() => ({ ...args }));
  cli.runPreflight.mockResolvedValue({ target: "vyos@router", scripts: [] });
  cli.shouldSkip.mockResolvedValue(false);
  cli.repositorySnapshot.mockResolvedValue("snapshot");
  cli.pushBack.mockResolvedValue(false);
});

test("enables debug logging when the debug option is set", async () => {
  args = { command: "backup", target: "vyos@router", config: "/tmp/backup", debug: true };
  await cli.runCli();
  expect(cli.log.level).toBe("debug");
});

test("covers help, version, backup, and preflight branches", async () => {
  args.help = true;
  await cli.runCli();
  expect(cli.log.info).toHaveBeenCalledWith(cli.usage);
  expect(cli.runBackup).not.toHaveBeenCalled();
  expect(cli.runPreflight).not.toHaveBeenCalled();
  expect(cli.deploy).not.toHaveBeenCalled();
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
  expect(cli.closeAll).toHaveBeenCalled();
});

test("preflight failures use the mocked command and do not deploy", async () => {
  cli.runPreflight.mockRejectedValue(new Error("invalid config"));
  await cli.runCli();
  expect(cli.log.error).toHaveBeenCalledWith("invalid config");
  expect(cli.deploy).not.toHaveBeenCalled();
  expect(cli.closeAll).toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});

test("passes a password read from stdin to the backup command", async () => {
  args = { command: "backup", passwordStdin: true };
  await cli.runCli();
  expect(cli.readPasswordStdin).toHaveBeenCalledWith(process.stdin);
  expect(cli.runBackup.mock.calls[0][0].password).toBe("stdin-secret");
});

test("dispatches release workflow", async () => {
  args = { command: "release", config: "config.boot", noPushback: false };
  await cli.runCli();
  expect(cli.runRelease).toHaveBeenCalledWith(expect.objectContaining(args), cli.log);
  expect(cli.runRelease).toHaveBeenCalledTimes(1);
});

test("does not run a release workflow for other commands", async () => {
  args = { command: "other", config: "config.boot" };
  await cli.runCli();
  expect(cli.runRelease).not.toHaveBeenCalled();
});

test("forces a release when unchanged files would normally skip deployment", async () => {
  args = { command: "release", config: "config.boot", noPushback: false, force: true };
  await cli.runCli();
  expect(cli.runRelease).toHaveBeenCalled();
  expect(cli.closeAll).toHaveBeenCalled();
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

test("reports SSH close errors and removes process handlers", async () => {
  cli.closeAll.mockRejectedValueOnce(new Error("SSH close failed"));
  await cli.runCli();
  expect(cli.log.error).toHaveBeenCalledWith("SSH close failed");
  expect(cli.signals.removeHandlers).toHaveBeenCalled();
  expect(cli.errors.removeHandlers).toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});

test("runs both registered shutdown actions", async () => {
  await cli.signals.shutdownHook();
  expect(cli.closeAll).toHaveBeenCalled();
  expect(cli.cleanupActiveDeployments).toHaveBeenCalled();
});
