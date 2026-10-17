import { randomUUID } from "node:crypto";
import { shellQuote } from "../shell-quote.mjs";
import { snapshotRemoteScript } from "../remote/script/snapshot.mjs";

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
  let cleanupError;
  try {
    const result = await exec(client, `rm -rf -- ${shellQuote(snapshotDirectory)}`);
    if (result.code !== 0)
      cleanupError = new Error(`remote snapshot cleanup failed: ${result.stderr || result.stdout}`);
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError)
    throw new Error(cleanupError.message, { cause: operationError || cleanupError });
  if (operationError) throw operationError;
  log.debug(`[vyops] backed up script: ${name}`);
}
