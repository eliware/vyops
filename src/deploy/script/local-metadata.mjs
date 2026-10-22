import { fs } from "@eliware/common";
import { localScriptMetadata } from "./validation.mjs";

export function readScriptMetadata(readLocalFile, scriptsDir, name) {
  return localScriptMetadata(readLocalFile, fs.promises.stat, scriptsDir, name);
}
