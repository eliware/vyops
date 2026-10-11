import { isSafeScriptPath } from "../bundle.mjs";

export async function readDeploymentState(readFile, manifestPath) {
  try {
    const names = (await readFile(manifestPath, "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.startsWith("file\t"))
      .map((line) => line.split("\t")[1])
      .filter(Boolean);
    if (names.some((name) => !isSafeScriptPath(name)))
      throw new Error("deployment manifest contains an unsafe script path");
    return { managed: new Set(names), hasManifest: true };
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
