import { readDeploymentState } from "./manifest.mjs";

export async function readManagedPaths(readFile, manifestPath) {
  return (await readDeploymentState(readFile, manifestPath)).managed;
}
