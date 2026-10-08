import { readFile as defaultReadFile } from "node:fs/promises";

export function isSafeScriptPath(name) {
  return (
    typeof name === "string" &&
    /^[A-Za-z0-9._/@-]+$/.test(name) &&
    !name.startsWith("/") &&
    !name.split("/").some((part) => !part || part === "." || part === "..")
  );
}

export async function validateScriptManifest(config, readFile = defaultReadFile) {
  const manifestPath = `${config}.manifest.tsv`;
  let content;
  try {
    content = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
  const lines = content.split(/\r?\n/);
  const header = lines.shift();
  if (header !== "kind\tpath" && header !== "kind\tpath\tpreexisting")
    throw new Error("preflight failed: deployment manifest has an invalid header");
  const names = new Set();
  for (const line of lines) {
    if (!line) continue;
    const [kind, name, ...fields] = line.split("\t");
    if (kind !== "file" || !name || fields.length > 1)
      throw new Error("preflight failed: deployment manifest contains a malformed record");
    if (names.has(name))
      throw new Error("preflight failed: deployment manifest contains a duplicate script path");
    names.add(name);
  }
  if ([...names].some((name) => !isSafeScriptPath(name))) {
    throw new Error("preflight failed: deployment manifest contains an unsafe script path");
  }
  return new Set(names);
}
