import { scriptStateCommand } from "../../../src/deploy/script/state-command.mjs";

test("combines directory and file state commands", () => {
  const command = scriptStateCommand({
    name: "nested/hook.sh",
    parent: "nested",
    installDir: "/config/scripts",
    backupDir: "/tmp/backup",
    backup: "/tmp/backup/nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
  });
  expect(command).toContain("directory\\t%s");
  expect(command).toContain("destination is a symlink");
  expect(command).toContain("sha256sum");
});
