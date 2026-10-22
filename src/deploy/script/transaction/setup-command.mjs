import { deploymentManifestHeader } from "../../../manifest/columns.mjs";

export function scriptTransactionSetupCommand({ remoteDir, backupDir, installDir, manifest }) {
  return `mkdir -m 700 ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)} && printf '%s\\n' ${JSON.stringify(deploymentManifestHeader)} > ${JSON.stringify(manifest)}`;
}
