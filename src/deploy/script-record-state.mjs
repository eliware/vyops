import { exec } from "../ssh/exec.mjs";
import { scriptDirectoryState } from "./script-directory-state.mjs";
import { scriptFileState } from "./script-file-state.mjs";

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
  const directoryMetadata = scriptDirectoryState({ parent, installDir, manifest });
  const fileMetadata = scriptFileState({
    name,
    parent,
    backupDir,
    backup,
    installed,
    manifest,
  });
  const result = await exec(
    client,
    `${directoryMetadata}${directoryMetadata ? "; " : ""}${fileMetadata}`,
  );
  if (result.code !== 0)
    throw new Error(
      `script backup failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
