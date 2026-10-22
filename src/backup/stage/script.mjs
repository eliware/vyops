import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { snapshotRemoteScript } from "../remote/script/snapshot.mjs";
import { cleanupRemoteScriptSnapshot } from "../remote/script/cleanup.mjs";

export async function stageBackupScript({ fs, path, client, scripts, file, download, exec, log }) {
  const { name } = file;
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
    const content = await fs.readFile(local);
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== file.sha256) throw new Error(`remote script changed during backup: ${name}`);
  } catch (error) {
    operationError = error;
  }
  await cleanupRemoteScriptSnapshot(exec, client, snapshotDirectory, operationError);
  log.debug(`[vyops] backed up script: ${name}`);
  return file;
}
