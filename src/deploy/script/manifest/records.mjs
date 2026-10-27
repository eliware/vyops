import { isSafeScriptPath } from "../../../bundle/script/path-rules.mjs";
import { deploymentManifestHeader } from "../../../manifest/columns.mjs";

export function parseDeploymentRecords(content) {
  const [header, ...lines] = content.split(/\r?\n/);
  if (header !== deploymentManifestHeader)
    throw new Error("deployment manifest has an invalid header");
  const records = lines.filter(Boolean).map((line) => line.split("\t"));
  if (
    records.some(
      (fields) => fields.length !== 9 || !["file", "directory"].includes(fields[0]) || !fields[1],
    )
  )
    throw new Error("deployment manifest contains a malformed record");
  const names = records.map((fields) => fields[1]);
  if (new Set(names).size !== names.length)
    throw new Error("deployment manifest contains a duplicate script path");
  if (names.some((name) => !isSafeScriptPath(name)))
    throw new Error("deployment manifest contains an unsafe script path");
  return records;
}
