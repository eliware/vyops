import { scriptTransactionSetupCommand } from "./transaction/command.mjs";

export async function runScriptSyncTransaction(options, dependencies) {
  const {
    names,
    client,
    remoteDir,
    backupDir,
    installDir,
    manifest,
    scriptsDir,
    previouslyManaged,
    verifyBinaries,
    redact,
    runId,
    debugLog,
  } = options;
  const {
    exec,
    stageScript,
    installStagedScripts,
    rollbackScripts,
    log,
    readLocalFile,
    stat,
    eliwarePath,
  } = dependencies;
  const made = await exec(
    client,
    scriptTransactionSetupCommand({ remoteDir, backupDir, installDir, manifest }),
  );
  if (made.code !== 0)
    throw new Error(`script directory setup failed: ${made.stderr || made.stdout}`.trim());
  const staged = [];
  try {
    for (const name of names) {
      await stageScript({
        name,
        client,
        scriptsDir,
        remoteDir,
        installDir,
        backupDir,
        manifest,
        previouslyManaged,
        readLocalFile,
        stat,
        eliwarePath,
        verifyBinaries,
        redact,
        staged,
      });
    }
    await installStagedScripts({
      staged,
      client,
      backupDir,
      installDir,
      runId,
      manifest,
      redact,
      debugLog,
    });
  } catch (error) {
    const restored = await rollbackScripts(exec, log, {
      client,
      manifest,
      installDir,
      backupDir,
      remoteDir,
    });
    if (!restored) error.preserveScriptsBackup = true;
    throw error;
  }
}
