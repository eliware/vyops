export function scriptDirectoryState({ parent, installDir, manifest }) {
  const ancestors =
    parent === "."
      ? []
      : parent.split("/").map((_, index, parts) => parts.slice(0, index + 1).join("/"));
  return ancestors
    .map(
      (directory) =>
        `if ! sudo awk -F '\\t' -v p=${JSON.stringify(directory)} '$1 == "directory" && $2 == p { found=1 } END { exit found ? 0 : 1 }' ${JSON.stringify(manifest)}; then if sudo test -d ${JSON.stringify(`${installDir}/${directory}`)}; then dirPreexisting=true; dirMode=$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)}); dirType=$(sudo stat -c %F ${JSON.stringify(`${installDir}/${directory}`)}); else dirPreexisting=false; dirMode=-; dirType=-; fi; sudo mkdir -p ${JSON.stringify(`${installDir}/${directory}`)}; printf 'directory\\t%s\\t%s\\t%s\\t-\\t%s\\t%s\\t-\\tdirectory\\n' ${JSON.stringify(directory)} "$dirPreexisting" "$dirMode" "$dirType" "$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)})" >> ${JSON.stringify(manifest)}; fi`,
    )
    .join("; ");
}
