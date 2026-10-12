import { posix as posixPath } from "node:path";
import { localScriptMetadata } from "./script-validation.mjs";
import { fs } from "@eliware/common";
import { recordScriptState } from "./script-record-state.mjs";
import { uploadStagedScript } from "./upload-staged-script.mjs";

export async function stageScript(options) {
  const {
    name,
    client,
    scriptsDir,
    remoteDir,
    installDir,
    backupDir,
    manifest,
    previouslyManaged,
    readLocalFile,
    eliwarePath,
    verifyBinaries,
    redact,
    staged,
  } = options;

  const local = eliwarePath(scriptsDir, name);
  const remote = `${remoteDir}/${name}`;
  const installed = `${installDir}/${name}`;
  const backup = `${backupDir}/${name}`;
  const parent = posixPath.dirname(name);
  const { mode, executable, binary, localHash } = await localScriptMetadata(
    readLocalFile,
    fs.promises.stat,
    scriptsDir,
    name,
  );
  await recordScriptState({
    client,
    name,
    parent,
    installDir,
    backupDir,
    backup,
    installed,
    manifest,
    redact,
  });
  await uploadStagedScript({
    client,
    name,
    local,
    remote,
    remoteDir,
    parent,
    mode,
    executable,
    binary,
    localHash,
    verifyBinaries,
    redact,
  });
  staged.push({
    name,
    remote,
    installed,
    parent,
    mode,
    executable,
    binary,
    managed: previouslyManaged.has(name),
  });
}
