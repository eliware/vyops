import { scriptDirectoryState } from "./directory/state.mjs";
import { scriptFileState } from "./file/state.mjs";

export function scriptStateCommand(options) {
  const directoryMetadata = scriptDirectoryState(options);
  const fileMetadata = scriptFileState(options);
  return `${directoryMetadata}${directoryMetadata ? "; " : ""}${fileMetadata}`;
}
