import { exec } from "../ssh/exec.mjs";

export async function writeInstalledScriptManifest({ client, name, installed, manifest, redact }) {
  const result = await exec(
    client,
    `file_mode=$(sudo stat -c %a ${JSON.stringify(installed)}) && file_hash_output=$(sudo sha256sum ${JSON.stringify(installed)}) && file_hash=\${file_hash_output%% *} && file_type=$(sudo stat -c %F ${JSON.stringify(installed)}) && test -n "$file_mode" && test -n "$file_hash" && test -n "$file_type" && printf 'file\\t%s\\t-\\t-\\t-\\t-\\t%s\\t%s\\t%s\\n' ${JSON.stringify(name)} "$file_mode" "$file_hash" "$file_type" >> ${JSON.stringify(manifest)}`,
  );
  if (result.code !== 0)
    throw new Error(
      `manifest update failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
