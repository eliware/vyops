import { directoryRollbackCommands } from "./directory/rollback-command.mjs";
import { fileRollbackCommands } from "./file/rollback-command.mjs";

export function scriptRollbackCommand({ manifest, installDir, backupDir, remoteDir }) {
  return [
    "safe_name() {",
    '  [ -n "$1" ] || return 1',
    `  printf '%s\\n' "$1" | grep -Eq '^[A-Za-z0-9._/@-]+$' || return 1`,
    `  ! printf '/%s/\\n' "$1" | grep -Eq '(^|/)\\.\\.?(/|$)|//'`,
    "}",
    ...fileRollbackCommands({ manifest, installDir, backupDir, remoteDir }),
    ...directoryRollbackCommands({ manifest, installDir, remoteDir }),
    `rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`,
  ].join("\n");
}
