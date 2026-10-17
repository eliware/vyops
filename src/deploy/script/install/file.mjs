import { exec } from "../../../ssh/exec.mjs";
import { buildScriptInstallCommand } from "./command.mjs";

export async function installStagedScript({
  stagedScript,
  client,
  backupDir,
  installDir,
  runId,
  redact,
}) {
  const { name } = stagedScript;
  const result = await exec(
    client,
    buildScriptInstallCommand(stagedScript, { backupDir, installDir, runId }),
  );
  if (result.code !== 0)
    throw new Error(
      `script install failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
