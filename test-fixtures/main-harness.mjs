export async function setupMainHarness(jest) {
  const parseArgs = jest.fn();
  const usage = "Usage: vyops";
  const deploy = jest.fn();
  const cleanupActiveDeployments = jest.fn();
  const runBackup = jest.fn();
  const runPreflight = jest.fn();
  const runRelease = jest.fn();
  const pushBack = jest.fn();
  const repositorySnapshot = jest.fn();
  const shouldSkip = jest.fn();
  const closeAll = jest.fn();
  const log = { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const errors = { removeHandlers: jest.fn() };
  const signals = { removeHandlers: jest.fn() };
  await jest.isolateModulesAsync(async () => {
    jest.unstable_mockModule("../src/args.mjs", () => ({ parseArgs }));
    jest.unstable_mockModule("../src/cli/usage.mjs", () => ({ usage }));
    jest.unstable_mockModule("../src/deploy.mjs", () => ({ deploy, cleanupActiveDeployments }));
    jest.unstable_mockModule("../src/commands/backup.mjs", () => ({ runBackup }));
    jest.unstable_mockModule("../src/commands/preflight.mjs", () => ({ runPreflight }));
    jest.unstable_mockModule("../src/commands/run-release.mjs", () => ({ runRelease }));
    jest.unstable_mockModule("../src/ssh.mjs", () => ({ closeAll }));
    jest.unstable_mockModule("@eliware/common", () => ({
      log,
      registerHandlers: jest.fn(() => errors),
      registerSignals: jest.fn(({ shutdownHook }) => {
        signals.shutdownHook = shutdownHook;
        return signals;
      }),
    }));
    const imported = await import("../src/main.mjs");
    Object.assign(errors, { runCli: imported.runCli });
  });
  const runCli = errors.runCli;
  return {
    args: {},
    cleanupActiveDeployments,
    closeAll,
    deploy,
    errors,
    log,
    parseArgs,
    runRelease,
    pushBack,
    repositorySnapshot,
    runBackup,
    runCli,
    runPreflight,
    shouldSkip,
    signals,
    usage,
  };
}
