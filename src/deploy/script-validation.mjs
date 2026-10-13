import { readLocalScriptContent } from "./local-script-content.mjs";
import { localScriptMetadataForContent } from "./local-script-metadata.mjs";

export async function localScriptMetadata(readFile, stat, basePath, name) {
  const local = `${basePath}/${name}`;
  const content = await readLocalScriptContent(readFile, local);
  return localScriptMetadataForContent(content, stat, local, name);
}
