import { join } from "node:path";
import { posix as posixPath } from "node:path";
import { localScriptMetadata } from "./script-validation.mjs";
import { exec } from "../ssh/exec.mjs";
import { upload } from "../ssh/upload.mjs";
import { fs } from "@eliware/common";

export async function stageScript(options) {
  const {
    name,
    client,
    scriptsDir,
    remoteDir,
    installDir,
    backupDir,
    manifest,
    previouslyManaged,
    readLocalFile,
    eliwarePath,
    verifyBinaries,
    redact,
    staged,
  } = options;

  const local = eliwarePath(scriptsDir, name);
  const remote = `${remoteDir}/${name}`;
  const installed = `${installDir}/${name}`;
  const backup = `${backupDir}/${name}`;
  const parent = posixPath.dirname(name);
  const { mode, executable, binary, localHash } = await localScriptMetadata(
    readLocalFile,
    fs.promises.stat,
    scriptsDir,
    name,
  );
  const ancestors =
    parent === "."
      ? []
      : parent.split("/").map((_, index, parts) => parts.slice(0, index + 1).join("/"));
  const directoryMetadata = ancestors
    .map(
      (directory) =>
        `if ! sudo awk -F '\\t' -v p=${JSON.stringify(directory)} '$1 == "directory" && $2 == p { found=1 } END { exit found ? 0 : 1 }' ${JSON.stringify(manifest)}; then if sudo test -d ${JSON.stringify(`${installDir}/${directory}`)}; then dirPreexisting=true; dirMode=$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)}); dirType=$(sudo stat -c %F ${JSON.stringify(`${installDir}/${directory}`)}); else dirPreexisting=false; dirMode=-; dirType=-; fi; sudo mkdir -p ${JSON.stringify(`${installDir}/${directory}`)}; printf 'directory\\t%s\\t%s\\t%s\\t-\\t%s\\t%s\\t-\\tdirectory\\n' ${JSON.stringify(directory)} "$dirPreexisting" "$dirMode" "$dirType" "$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)})" >> ${JSON.stringify(manifest)}; fi`,
    )
    .join("; ");
  const existingRecord = previouslyManaged.has(name)
    ? `sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)} && sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)} && printf 'file\\t%s\\ttrue\\t%s\\t%s\\t%s\\t-\\t-\\t-\\n'`
    : `printf 'file\\t%s\\tunmanaged\\t-\\t-\\t-\\t-\\t-\\t-\\n'`;
  const backedUp = await exec(
    client,
    `${directoryMetadata}${directoryMetadata ? "; " : ""}if sudo test -L ${JSON.stringify(installed)}; then echo 'destination is a symlink' >&2; exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)} && ${existingRecord} ${JSON.stringify(name)}${previouslyManaged.has(name) ? ` "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" "$(sudo stat -c %F ${JSON.stringify(installed)})"` : ""} >> ${JSON.stringify(manifest)}; else printf 'file\\t%s\\tfalse\\t-\\t-\\t-\\t-\\t-\\t-\\n' ${JSON.stringify(name)} >> ${JSON.stringify(manifest)}; fi`,
  );
  if (backedUp.code !== 0)
    throw new Error(
      `script backup failed (${name}): ${redact(backedUp.stderr || backedUp.stdout)}`.trim(),
    );
  if (parent !== ".") {
    const remoteParent = `${remoteDir}/${parent}`;
    const remoteParentResult = await exec(client, `mkdir -p ${JSON.stringify(remoteParent)}`);
    if (remoteParentResult.code !== 0)
      throw new Error(
        `script upload directory setup failed (${join(parent, name.slice(parent.length + 1))}): ${remoteParentResult.stderr || remoteParentResult.stdout}`.trim(),
      );
  }
  await upload(client, local, remote, mode);
  const remotePreflightChecks = `test -f ${JSON.stringify(remote)} && test ! -L ${JSON.stringify(remote)} && test "$(realpath -- ${JSON.stringify(remote)})" = ${JSON.stringify(remote)}${
    executable ? ` && test -x ${JSON.stringify(remote)}` : ""
  }`;
  const remoteLineEndingCheck = binary
    ? "true"
    : `! grep -q "$(printf '\\r')" ${JSON.stringify(remote)}`;
  const remoteBinaryCheck = binary
    ? `case "$(uname -m):$(file -b ${JSON.stringify(remote)})" in x86_64:*ELF*x86-64*|aarch64:*ELF*ARM\\ aarch64*|armv7l:*ELF*ARM*) ;; *) exit 1 ;; esac${verifyBinaries ? ` && test "$(sha256sum ${JSON.stringify(remote)} | awk '{print $1}')" = ${JSON.stringify(localHash)}` : ""}`
    : "true";
  const remotePreflightResult = await exec(
    client,
    `${remotePreflightChecks} && ${remoteLineEndingCheck} && ${remoteBinaryCheck}`,
  );
  if (remotePreflightResult.code !== 0) {
    throw new Error(
      `remote script preflight failed (${name}): ${redact(remotePreflightResult.stderr || remotePreflightResult.stdout || "mode or line-ending check failed")}`.trim(),
    );
  }
  staged.push({
    name,
    remote,
    installed,
    parent,
    mode,
    executable,
    binary,
    managed: previouslyManaged.has(name),
  });
}
