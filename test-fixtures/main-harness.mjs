export async function setupMainHarness(jest) {
  const parseArgs = jest.fn();
  const usage = "Usage: vyops";
  const deploy = jest.fn();
  const cleanupActiveDeployments = jest.fn();
  const readAndValidateConfig = jest.fn();
  const runBackup = jest.fn();
  const runPreflight = jest.fn();
  const prepareRelease = jest.fn();
  const pushBack = jest.fn();
  const repositorySnapshot = jest.fn();
  const shouldSkip = jest.fn();
  const closeAll = jest.fn();
  const log = { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const errors = { removeHandlers: jest.fn() };
  const signals = { removeHandlers: jest.fn() };
  await jest.isolateModulesAsync(async () => {
    jest.unstable_mockModule("../src/args.mjs", () => ({ parseArgs, usage }));
    jest.unstable_mockModule("../src/deploy.mjs", () => ({ deploy, cleanupActiveDeployments }));
    jest.unstable_mockModule("../src/validate.mjs", () => ({ readAndValidateConfig }));
    jest.unstable_mockModule("../src/commands/backup.mjs", () => ({ runBackup }));
    jest.unstable_mockModule("../src/commands/preflight.mjs", () => ({ runPreflight }));
    jest.unstable_mockModule("../src/commands/release.mjs", () => ({ prepareRelease }));
    jest.unstable_mockModule("../src/git.mjs", () => ({
      pushBack,
      repositorySnapshot,
      shouldSkip,
    }));
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
    prepareRelease,
    pushBack,
    readAndValidateConfig,
    repositorySnapshot,
    runBackup,
    runCli,
    runPreflight,
    shouldSkip,
    signals,
    usage,
  };
}
