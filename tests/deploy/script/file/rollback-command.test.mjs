import { fileRollbackCommands } from "../../../../src/deploy/script/file/rollback-command.mjs";

test("builds guarded commands to remove and restore files", () => {
  const command = fileRollbackCommands({
    manifest: "/tmp/m.tsv",
    installDir: "/config/scripts",
    backupDir: "/tmp/b",
    remoteDir: "/tmp/r",
  }).join("\n");
  expect(command).toContain('$1 == "file" && $3 == "false"');
  expect(command).toContain('safe_name "$name" || exit 1');
  expect(command).toContain('sudo rm -f -- "/config/scripts"/"$name" || exit 1');
  expect(command).toContain('sudo cp -a "/tmp/b/." "/config/scripts/"');
});
