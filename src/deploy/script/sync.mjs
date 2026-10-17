import { readFile as readLocalFile } from "node:fs/promises";
import { fs, path as eliwarePath, log } from "@eliware/common";
import { exec } from "../../ssh/exec.mjs";
import { listScripts } from "./tree.mjs";
import { finalizeScripts } from "./finalize.mjs";
import { rollbackScripts } from "./rollback.mjs";
import { isSafeScriptPath } from "../../bundle.mjs";
import { deploymentRemotePaths } from "../remote/paths.mjs";
import { stageScript } from "./staging.mjs";
import { installStagedScripts } from "./install.mjs";
import { inspectLiveScripts } from "../inspect-live-scripts.mjs";
import { runScriptSyncTransaction } from "./sync-transaction.mjs";

export async function installScripts(client, config, debugLog, runId, verifyBinaries, redact) {
  const scriptsDir = eliwarePath(config, "..", "scripts");
  const names = await listScripts(fs, eliwarePath, scriptsDir);
  if (names === null) return null;
  if (names.some((name) => !isSafeScriptPath(name))) {
    throw new Error("script path is invalid");
  }
  const remotePaths = deploymentRemotePaths(runId);
  const remoteDir = remotePaths.scripts;
  const backupDir = remotePaths.scriptsBackup;
  const manifest = remotePaths.manifest;
  const installDir = "/config/scripts";
  const previouslyManaged = await inspectLiveScripts(client, config, names);
  if (!names.length) return null;
  await runScriptSyncTransaction(
    {
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
    },
    {
      exec,
      stageScript,
      installStagedScripts,
      rollbackScripts,
      log,
      readLocalFile,
      stat: fs.promises.stat,
      eliwarePath,
    },
  );
  return async (committed, activeClient) => {
    await finalizeScripts(exec, log, {
      client: activeClient,
      committed,
      manifest,
      installDir,
      backupDir,
      remoteDir,
    });
  };
}
