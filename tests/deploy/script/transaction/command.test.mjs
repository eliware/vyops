import { deploymentManifestHeader } from "../../../../src/manifest/columns.mjs";
import { scriptTransactionSetupCommand } from "../../../../src/deploy/script/transaction/command.mjs";

test("builds the remote script transaction setup command", () => {
  const command = scriptTransactionSetupCommand({
    remoteDir: "/tmp/run/scripts",
    backupDir: "/tmp/run/backup",
    installDir: "/config/scripts",
    manifest: "/tmp/run/manifest.tsv",
  });
  expect(command).toContain('mkdir -m 700 "/tmp/run/scripts" "/tmp/run/backup"');
  expect(command).toContain('sudo mkdir -p "/config/scripts"');
  expect(command).toContain(JSON.stringify(deploymentManifestHeader));
});
