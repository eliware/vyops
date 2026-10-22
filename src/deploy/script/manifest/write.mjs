import { exec } from "../../../ssh/exec.mjs";
import { installedScriptManifestCommand } from "./command.mjs";

export async function writeInstalledScriptManifest({ client, name, installed, manifest, redact }) {
  const command = installedScriptManifestCommand({ name, installed, manifest });
  const result = await exec(client, command);
  if (result.code !== 0)
    throw new Error(
      `manifest update failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
