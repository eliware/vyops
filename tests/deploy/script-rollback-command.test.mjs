import { scriptRollbackCommand } from "../../src/deploy/script-rollback-command.mjs";

test("checks manifest paths before rollback removes files", () => {
  const command = scriptRollbackCommand({
    manifest: "/tmp/m.tsv",
    installDir: "/config/scripts",
    backupDir: "/tmp/b",
    remoteDir: "/tmp/r",
  });
  expect(command).toContain('safe_name "$name" || exit 1');
  expect(command).toContain('case "/$1/" in');
  expect(command).toContain("sort -r");
  expect(command).toContain("2>/dev/null || exit 1");
  expect(command).toContain('> "/tmp/r/rollback-files.tsv" || exit 1');
  expect(command).toContain('> "/tmp/r/rollback-directories.tsv" || exit 1');
  expect(command).toContain('rmdir -- "/config/scripts"/"$name" 2>/dev/null || exit 1');
  expect(command).not.toContain("| while IFS= read -r name");
  expect(command).not.toContain("|| true");
  expect(command).not.toContain("cp -a '/tmp/b/.' '/config/scripts/' 2>/dev/null || true");
});
