import { readFile as readLocalFile } from "node:fs/promises";
import { fs, path as eliwarePath, log } from "@eliware/common";
import { exec } from "../../ssh/exec.mjs";
import { rollbackScripts } from "./rollback.mjs";
import { stageScript } from "./staging.mjs";
import { installStagedScripts } from "./install.mjs";

export function scriptSyncDependencies() {
  return {
    exec,
    stageScript,
    installStagedScripts,
    rollbackScripts,
    log,
    readLocalFile,
    stat: fs.promises.stat,
    eliwarePath,
  };
}
