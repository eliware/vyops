import { jest } from "@jest/globals";
const { runScriptSyncTransaction } =
  await import("../../../src/deploy/script/sync-transaction.mjs");

const options = {
  names: ["first.sh", "nested/second.sh"],
  client: {},
  remoteDir: "/tmp/run/scripts",
  backupDir: "/tmp/run/backup",
  installDir: "/config/scripts",
  manifest: "/tmp/run/manifest.tsv",
  scriptsDir: "/bundle/scripts",
  previouslyManaged: new Set(),
  verifyBinaries: true,
  redact: (value) => value,
  runId: "run-id",
  debugLog: jest.fn(),
};

function makeDependencies() {
  return {
    exec: jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" }),
    stageScript: jest.fn().mockResolvedValue(undefined),
    installStagedScripts: jest.fn().mockResolvedValue(undefined),
    rollbackScripts: jest.fn().mockResolvedValue(undefined),
    log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    readLocalFile: jest.fn(),
    stat: jest.fn(),
    eliwarePath: (...parts) => parts.join("/"),
  };
}

test("stages each script and installs the staged set", async () => {
  const dependencies = makeDependencies();
  dependencies.stageScript.mockImplementation(async ({ name, staged }) => staged.push(name));

  await runScriptSyncTransaction(options, dependencies);

  expect(dependencies.exec).toHaveBeenCalledTimes(1);
  expect(dependencies.stageScript).toHaveBeenCalledTimes(2);
  expect(dependencies.stageScript.mock.calls[0][0]).toMatchObject({
    name: "first.sh",
    scriptsDir: options.scriptsDir,
    verifyBinaries: true,
  });
  expect(dependencies.installStagedScripts).toHaveBeenCalledWith(
    expect.objectContaining({ staged: ["first.sh", "nested/second.sh"] }),
  );
  expect(dependencies.rollbackScripts).not.toHaveBeenCalled();
});

test.each([
  [{ code: 1, stderr: "denied", stdout: "" }, "denied"],
  [{ code: 1, stderr: "", stdout: "setup output" }, "setup output"],
])("reports remote setup failures", async (result, message) => {
  const dependencies = makeDependencies();
  dependencies.exec.mockResolvedValueOnce(result);

  await expect(runScriptSyncTransaction(options, dependencies)).rejects.toThrow(
    `script directory setup failed: ${message}`,
  );
  expect(dependencies.stageScript).not.toHaveBeenCalled();
  expect(dependencies.installStagedScripts).not.toHaveBeenCalled();
});

test("uses a blank diagnostic when remote setup returns no output", async () => {
  const dependencies = makeDependencies();
  dependencies.exec.mockResolvedValueOnce({ code: 1, stderr: "", stdout: "" });

  await expect(runScriptSyncTransaction(options, dependencies)).rejects.toThrow(
    "script directory setup failed:",
  );
});

test("supports an empty transaction", async () => {
  const dependencies = makeDependencies();

  await runScriptSyncTransaction({ ...options, names: [] }, dependencies);

  expect(dependencies.stageScript).not.toHaveBeenCalled();
  expect(dependencies.installStagedScripts).toHaveBeenCalledWith(
    expect.objectContaining({ staged: [] }),
  );
});

test.each(["staging", "installation"])("rolls back after %s fails", async (phase) => {
  const dependencies = makeDependencies();
  const failure = new Error(`${phase} failed`);
  if (phase === "staging") dependencies.stageScript.mockRejectedValueOnce(failure);
  else dependencies.installStagedScripts.mockRejectedValueOnce(failure);

  await expect(runScriptSyncTransaction(options, dependencies)).rejects.toBe(failure);
  expect(dependencies.rollbackScripts).toHaveBeenCalledWith(
    dependencies.exec,
    dependencies.log,
    expect.objectContaining({
      client: options.client,
      manifest: options.manifest,
      installDir: options.installDir,
      backupDir: options.backupDir,
      remoteDir: options.remoteDir,
    }),
  );
});
