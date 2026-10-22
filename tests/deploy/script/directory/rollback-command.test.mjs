import { directoryRollbackCommands } from "../../../../src/deploy/script/directory/rollback-command.mjs";

test("builds guarded commands to remove directories in reverse order", () => {
  const command = directoryRollbackCommands({
    manifest: "/tmp/m.tsv",
    installDir: "/config/scripts",
    remoteDir: "/tmp/r",
  }).join("\n");
  expect(command).toContain('$1 == "directory" && $3 == "false"');
  expect(command).toContain('sort -r "/tmp/r/rollback-directories.tsv"');
  expect(command).toContain('safe_name "$name" || exit 1');
  expect(command).toContain('sudo rmdir -- "/config/scripts"/"$name" 2>/dev/null || exit 1');
});
