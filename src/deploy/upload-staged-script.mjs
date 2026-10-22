import { join } from "node:path";
import { exec } from "../ssh/exec.mjs";
import { upload } from "../ssh/upload.mjs";

export const binaryArchitecturePattern =
  "^(x86_64:.*ELF.*x86-64.*|aarch64:.*ELF.*ARM aarch64.*|armv7l:.*ELF.*ARM(,|$).*)$";

export async function uploadStagedScript({
  client,
  name,
  local,
  remote,
  remoteDir,
  parent,
  mode,
  executable,
  binary,
  localHash,
  verifyBinaries,
  redact,
}) {
  if (parent !== ".") {
    const result = await exec(client, `mkdir -p ${JSON.stringify(`${remoteDir}/${parent}`)}`);
    if (result.code !== 0)
      throw new Error(
        `script upload directory setup failed (${join(parent, name.slice(parent.length + 1))}): ${result.stderr || result.stdout}`.trim(),
      );
  }
  await upload(client, local, remote, mode);
  const pathCheck = `test -f ${JSON.stringify(remote)} && test ! -L ${JSON.stringify(remote)} && test "$(realpath -- ${JSON.stringify(remote)})" = ${JSON.stringify(remote)}${executable ? ` && test -x ${JSON.stringify(remote)}` : ""}`;
  const lineEndingCheck = binary ? "true" : `! grep -q "$(printf '\\r')" ${JSON.stringify(remote)}`;
  const binaryCheck = binary
    ? [
        `printf '%s\\n' "$(uname -m):$(file -b ${JSON.stringify(remote)})"`,
        `| grep -Eq '${binaryArchitecturePattern}'`,
        verifyBinaries
          ? `&& test "$(sha256sum ${JSON.stringify(remote)} | awk '{print $1}')" = ${JSON.stringify(localHash)}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "true";
  const result = await exec(client, `${pathCheck} && ${lineEndingCheck} && ${binaryCheck}`);
  if (result.code !== 0)
    throw new Error(
      `remote script preflight failed (${name}): ${redact(result.stderr || result.stdout || "mode or line-ending check failed")}`.trim(),
    );
}
