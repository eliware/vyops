import { readFile as readLocalFile } from "node:fs/promises";
import { fs, path as eliwarePath, log } from "@eliware/common";
import { exec } from "../ssh/exec.mjs";
import { listScripts } from "./script-tree.mjs";
import { finalizeScripts, rollbackScripts } from "./script-rollback.mjs";
import { isSafeScriptPath } from "../bundle.mjs";
import { deploymentRemotePaths } from "./remote-paths.mjs";
import { stageScript } from "./script-staging.mjs";
import { installStagedScripts } from "./script-install.mjs";
import { inspectLiveScripts } from "./inspect-live-scripts.mjs";

export async function installScripts(
  client,
  config,
  debugLog,
  runId,
  verifyBinaries,
  redact = (value) => value,
) {
  const scriptsDir = eliwarePath(config, "..", "scripts");
  let names;
  try {
    names = await listScripts(fs, eliwarePath, scriptsDir);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (names.some((name) => !isSafeScriptPath(name))) {
    throw new Error("script path is invalid");
  }
  const remotePaths = deploymentRemotePaths(runId);
  const remoteDir = remotePaths.scripts;
  const backupDir = remotePaths.scriptsBackup;
  const manifest = remotePaths.manifest;
  const installDir = "/config/scripts";
  const previouslyManaged = await inspectLiveScripts(client, config);
  if (!names.length) return null;
  const made = await exec(
    client,
    `mkdir -m 700 ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)} && printf '%s\\n' 'kind\\tpath\\tpreexisting\\told_mode\\told_sha256\\told_type\\tnew_mode\\tnew_sha256\\tnew_type' > ${JSON.stringify(manifest)}`,
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
        stat: fs.promises.stat,
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
    await rollbackScripts(exec, log, { client, manifest, installDir, backupDir, remoteDir });
    throw error;
  }
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
