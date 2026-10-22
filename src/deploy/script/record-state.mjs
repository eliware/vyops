import { exec } from "../../ssh/exec.mjs";
import { scriptStateCommand } from "./state-command.mjs";

export async function recordScriptState({
  client,
  name,
  parent,
  installDir,
  backupDir,
  backup,
  installed,
  manifest,
  redact,
}) {
  const command = scriptStateCommand({
    parent,
    installDir,
    name,
    backupDir,
    backup,
    installed,
    manifest,
  });
  const result = await exec(client, command);
  if (result.code !== 0)
    throw new Error(
      `script backup failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
