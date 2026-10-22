import { parseDeploymentState } from "./manifest/parser.mjs";

export async function readDeploymentState(readFile, manifestPath) {
  try {
    return parseDeploymentState(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { managed: new Set(), hasManifest: false };
    throw error;
  }
}
