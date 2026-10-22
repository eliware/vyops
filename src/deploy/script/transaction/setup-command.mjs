import { deploymentManifestHeader } from "../../../manifest/columns.mjs";

export function scriptTransactionSetupCommand({ remoteDir, backupDir, installDir, manifest }) {
  const escapedHeader = deploymentManifestHeader.replaceAll("\t", "\\t");
  return `mkdir -m 700 ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)} && printf '%b\\n' ${JSON.stringify(escapedHeader)} > ${JSON.stringify(manifest)}`;
}
