import { isSafeScriptPath } from "../bundle/script-path-rules.mjs";

export async function readDeploymentState(readFile, manifestPath) {
  try {
    const [header, ...lines] = (await readFile(manifestPath, "utf8")).split(/\r?\n/);
    const expectedHeader =
      "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type";
    if (header !== expectedHeader) throw new Error("deployment manifest has an invalid header");
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
    const managed = records.filter((fields) => fields[0] === "file").map((fields) => fields[1]);
    return { managed: new Set(managed), hasManifest: true };
  } catch (error) {
    if (error.code === "ENOENT") return { managed: new Set(), hasManifest: false };
    throw error;
  }
}

export async function readManagedPaths(readFile, manifestPath) {
  return (await readDeploymentState(readFile, manifestPath)).managed;
}

export function unmanagedPaths(liveOutput, managed) {
  return liveOutput
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replace(/^\/config\/scripts\/?/, ""))
    .filter((file) => file && !managed.has(file));
}
