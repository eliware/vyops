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
});
