import { randomUUID } from "node:crypto";
import { snapshotRemoteScript } from "../remote/script/snapshot.mjs";
import { cleanupRemoteScriptSnapshot } from "../remote/script/cleanup.mjs";

export async function stageBackupScript({ fs, path, client, scripts, name, download, exec, log }) {
  const remote = `/config/scripts/${name}`;
  const snapshotDirectory = `/tmp/.vyops-backup.${randomUUID()}`;
  const snapshot = `${snapshotDirectory}/script`;
  const local = path(scripts, name);
  await snapshotRemoteScript(exec, client, remote, snapshotDirectory);
  let operationError;
  try {
    await fs.mkdir(path(local, ".."), { recursive: true, mode: 0o700 });
    await download(client, snapshot, local);
    await fs.chmod(local, 0o600);
  } catch (error) {
    operationError = error;
  }
  await cleanupRemoteScriptSnapshot(exec, client, snapshotDirectory, operationError);
  log.debug(`[vyops] backed up script: ${name}`);
}
