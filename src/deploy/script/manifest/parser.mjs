import { parseDeploymentRecords } from "./records.mjs";

export function parseDeploymentState(content) {
  const records = parseDeploymentRecords(content);
  const managed = records.filter((fields) => fields[0] === "file").map((fields) => fields[1]);
  return { managed: new Set(managed), hasManifest: true };
}
