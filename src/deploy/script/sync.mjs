import { fs, path as eliwarePath, log } from "@eliware/common";
import { exec } from "../../ssh/exec.mjs";
import { listScripts } from "./tree.mjs";
import { finalizeScripts } from "./finalize.mjs";
import { isSafeScriptPath } from "../../bundle.mjs";
import { deploymentRemotePaths } from "../remote/paths.mjs";
import { inspectLiveScripts } from "../inspect-live-scripts.mjs";
import { runScriptSyncTransaction } from "./sync-transaction.mjs";
import { scriptSyncDependencies } from "./transaction-dependencies.mjs";

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
    scriptSyncDependencies(),
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
