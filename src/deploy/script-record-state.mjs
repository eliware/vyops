import { exec } from "../ssh/exec.mjs";

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
  const existingRecord = `sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)} && sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)} && printf 'file\\t%s\\ttrue\\t%s\\t%s\\t%s\\t-\\t-\\t-\\n'`;
  const result = await exec(
    client,
    `${directoryMetadata}${directoryMetadata ? "; " : ""}if sudo test -L ${JSON.stringify(installed)}; then echo 'destination is a symlink' >&2; exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)} && ${existingRecord} ${JSON.stringify(name)} "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" "$(sudo stat -c %F ${JSON.stringify(installed)})" >> ${JSON.stringify(manifest)}; else printf 'file\\t%s\\tfalse\\t-\\t-\\t-\\t-\\t-\\t-\\n' ${JSON.stringify(name)} >> ${JSON.stringify(manifest)}; fi`,
  );
  if (result.code !== 0)
    throw new Error(
      `script backup failed (${name}): ${redact(result.stderr || result.stdout)}`.trim(),
    );
}
