export function installedScriptManifestCommand({ name, installed, manifest }) {
  const awkProgram = [
    "NR == 1 { print }",
    "$2 == path {",
    "  if (found > 0) {",
    "    bad = 1",
    "  } else {",
    "    $7 = mode",
    "    $8 = hash",
    "    $9 = type",
    "  }",
    "  found++",
    "  print",
    "}",
    "NR > 1 && $2 != path { print }",
    "END { if (found != 1 || bad) exit 1 }",
  ].join("\n");
  return [
    `file_mode=$(sudo stat -c %a ${JSON.stringify(installed)})`,
    `file_hash_output=$(sudo sha256sum ${JSON.stringify(installed)})`,
    "file_hash=${file_hash_output%% *}",
    `file_type=$(sudo stat -c %F ${JSON.stringify(installed)})`,
    'test -n "$file_mode"',
    'test -n "$file_hash"',
    'test -n "$file_type"',
    `manifest_tmp=${JSON.stringify(`${manifest}.tmp.$$`)}`,
    `awk -F '\\t' -v OFS='\\t' -v path=${JSON.stringify(name)} -v mode="$file_mode" -v hash="$file_hash" -v type="$file_type" '${awkProgram}' ${JSON.stringify(manifest)} > "$manifest_tmp"`,
    `mv -- "$manifest_tmp" ${JSON.stringify(manifest)}`,
  ].join(" &&\n");
}
