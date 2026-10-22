import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { cleanupDownloadedFiles } from "./cleanup.mjs";
import { rollbackDownloadedFiles } from "./rollback.mjs";

export async function downloadFilesToReplace(fs, download, client, files, log) {
  const staged = files.map(({ remote, local }) => ({
    remote,
    local,
    temporary: join(dirname(local), `.${basename(local)}.vyops-${randomUUID()}`),
    previous: join(dirname(local), `.${basename(local)}.previous-${randomUUID()}`),
  }));
  const saved = [];
  const installed = [];
  let rollbackComplete = true;
  try {
    for (const file of staged) {
      await fs.writeFile(file.temporary, "", { flag: "wx", mode: 0o600 });
      await download(client, file.remote, file.temporary);
    }
    for (const file of staged) {
      try {
        await fs.rename(file.local, file.previous);
        saved.push(file);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    for (const file of staged) {
      await fs.rename(file.temporary, file.local);
      installed.push(file);
    }
  } catch (error) {
    try {
      await rollbackDownloadedFiles(fs, installed, saved);
    } catch (rollbackError) {
      rollbackComplete = false;
      throw new Error(`local release state rollback failed: ${rollbackError.message}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    await cleanupDownloadedFiles(fs, staged, rollbackComplete, log);
  }
}
