import { isSafeScriptPath } from "../../../bundle/script/path-rules.mjs";
import { deploymentManifestHeader } from "../../../manifest/columns.mjs";

export function parseDeploymentState(content) {
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
  if (names.some((name) => !isSafeScriptPath(name)))
    throw new Error("deployment manifest contains an unsafe script path");
  const grouped = new Map();
  for (const record of records) {
    const group = grouped.get(record[1]) ?? [];
    group.push(record);
    grouped.set(record[1], group);
  }
  for (const group of grouped.values()) {
    if (group.length > 1 && !isLegacySplitFileState(group))
      throw new Error("deployment manifest contains a duplicate script path");
  }
  const managed = records.filter((fields) => fields[0] === "file").map((fields) => fields[1]);
  return { managed: new Set(managed), hasManifest: true };
}

function isLegacySplitFileState(records) {
  if (records.length !== 2 || records.some(([kind]) => kind !== "file")) return false;
  const prior = records.find(
    (record) =>
      ["true", "false"].includes(record[2]) && record.slice(6).every((value) => value === "-"),
  );
  const installed = records.find(
    (record) =>
      record[2] === "-" &&
      record.slice(3, 6).every((value) => value === "-") &&
      record.slice(6).every((value) => value !== "-"),
  );
  if (!prior || !installed) return false;
  const priorState = prior.slice(3, 6);
  return prior[2] === "true"
    ? priorState.every((value) => value !== "-")
    : priorState.every((value) => value === "-");
}
