import { fs, path, log as defaultLog } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { close, connect } from "./ssh.mjs";
import { exec } from "./ssh/exec.mjs";
import { download } from "./ssh/download.mjs";
import { backupDestination } from "./backup/destination.mjs";
import { inspectRemoteScripts } from "./backup/remote/inspection.mjs";
import { publishBackup } from "./backup/publish-backup.mjs";
import { stageBackup } from "./backup/stage/backup.mjs";

export async function backup({ target, config, password, log = defaultLog }) {
  config = backupDestination(config);
  const client =
    password === undefined ? await connect(target) : await connect(target, { password });
  try {
    const files = await inspectRemoteScripts(exec, client, log);
    const previousBackup = path(config, `.vyops-backup-old-${randomUUID()}`);
    const stagedBackup = path(config, `.vyops-backup-${randomUUID()}`);
    try {
      await stageBackup({
        fs: fs.promises,
        path,
        client,
        staged: stagedBackup,
        files,
        download,
        exec,
        log,
      });
      await publishBackup(fs.promises, stagedBackup, config, previousBackup, log);
      log.debug("[vyops] backup: published configuration, scripts, and manifest");
    } finally {
      await fs.promises.rm(stagedBackup, { recursive: true, force: true });
    }
    return 0;
  } finally {
    log.debug("[vyops] backup: closing SSH connection");
    await close(client);
  }
}
