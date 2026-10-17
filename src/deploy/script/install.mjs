import { installStagedScript } from "./install/file.mjs";
import { writeInstalledScriptManifest } from "./manifest-write.mjs";

export async function installStagedScripts(options) {
  const { staged, client, backupDir, installDir, runId, manifest, redact, debugLog } = options;
  for (const stagedScript of staged) {
    const { name, installed } = stagedScript;
    await installStagedScript({
      stagedScript,
      client,
      backupDir,
      installDir,
      runId,
      redact,
    });
    await writeInstalledScriptManifest({ client, name, installed, manifest, redact });
    debugLog(`installed script: ${name}`);
  }
}
