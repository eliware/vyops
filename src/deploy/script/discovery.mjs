import { isSafeScriptPath } from "../../bundle.mjs";
import { listScripts } from "./tree.mjs";

export async function discoverScriptNames(fs, path, directory) {
  const names = await listScripts(fs, path, directory);
  if (names === null) return null;
  if (names.some((name) => !isSafeScriptPath(name))) {
    throw new Error("script path is invalid");
  }
  return names;
}
