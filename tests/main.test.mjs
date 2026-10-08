import packageJson from "../package.json" with { type: "json" };
import { Readable } from "node:stream";
import "../src/main.mjs";
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
});

test("preflight failures use the mocked command and do not deploy", async () => {
  cli.runPreflight.mockRejectedValue(new Error("invalid config"));
  await cli.runCli();
  expect(cli.log.error).toHaveBeenCalledWith("invalid config");
  expect(cli.deploy).not.toHaveBeenCalled();
  expect(cli.closeAll).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
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
