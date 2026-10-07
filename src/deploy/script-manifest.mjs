import { isSafeScriptPath } from "../bundle.mjs";

export async function readManagedPaths(readFile, manifestPath) {
  try {
    const names = (await readFile(manifestPath, "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.startsWith("file\t"))
      .map((line) => line.split("\t")[1])
      .filter(Boolean);
    if (names.some((name) => !isSafeScriptPath(name)))
      throw new Error("deployment manifest contains an unsafe script path");
    return new Set(names);
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

export function unmanagedPaths(liveOutput, managed) {
  return liveOutput
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replace(/^\/config\/scripts\/?/, ""))
    .filter((file) => file && !managed.has(file));
}
