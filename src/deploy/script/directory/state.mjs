export function scriptDirectoryState({ parent, installDir, manifest }) {
  const ancestors =
    parent === "."
      ? []
      : parent.split("/").map((_, index, parts) => parts.slice(0, index + 1).join("/"));
  return ancestors
    .map((directory) => {
      const path = JSON.stringify(`${installDir}/${directory}`);
      const manifestPath = JSON.stringify(manifest);
      return [
        `if ! sudo awk -F '\\t' -v p=${JSON.stringify(directory)} '$1 == "directory" && $2 == p {`,
        "  found=1",
        `} END { exit found ? 0 : 1 }' ${manifestPath}`,
        "then",
        `  if sudo test -d ${path}`,
        "  then",
        "    dirPreexisting=true",
        `    dirMode=$(sudo stat -c %a ${path})`,
        `    dirType=$(sudo stat -c %F ${path})`,
        "  else",
        "    dirPreexisting=false",
        "    dirMode=-",
        "    dirType=-",
        "  fi",
        `  sudo mkdir -p ${path}`,
        `  printf 'directory\\t%s\\t%s\\t%s\\t-\\t%s\\t%s\\t-\\tdirectory\\n' ${JSON.stringify(directory)} "$dirPreexisting" "$dirMode" "$dirType" "$(sudo stat -c %a ${path})" >> ${manifestPath}`,
        "fi",
      ].join("\n");
    })
    .join("\n");
}
