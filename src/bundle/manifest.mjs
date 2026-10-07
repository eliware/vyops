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
  const names = content
    .split(/\r?\n/)
    .filter((line) => line.startsWith("file\t"))
    .map((line) => line.split("\t")[1])
    .filter(Boolean);
  if (names.some((name) => !isSafeScriptPath(name))) {
    throw new Error("preflight failed: deployment manifest contains an unsafe script path");
  }
  return new Set(names);
}
