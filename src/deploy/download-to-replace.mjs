import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

export async function downloadToReplace(fs, download, client, remote, local, log) {
  const temporary = join(dirname(local), `.${basename(local)}.vyops-${randomUUID()}`);
  try {
    await fs.writeFile(temporary, "", { flag: "wx", mode: 0o600 });
    await download(client, remote, temporary);
    await fs.rename(temporary, local);
  } catch (error) {
    try {
      await fs.rm(temporary, { force: true });
    } catch (cleanupError) {
      log?.warn?.(`VyOps cleanup warning: temporary file removal failed: ${cleanupError.message}`);
    }
    throw error;
  }
}

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
      for (const file of installed.reverse())
        await fs.rm(file.local, { force: true, recursive: true });
      for (const file of saved.reverse()) await fs.rename(file.previous, file.local);
    } catch (rollbackError) {
      rollbackComplete = false;
      throw new Error(`local release state rollback failed: ${rollbackError.message}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    for (const file of staged) {
      try {
        await fs.rm(file.temporary, { force: true });
      } catch (error) {
        log?.warn?.(`VyOps cleanup warning: temporary file removal failed: ${error.message}`);
      }
      if (rollbackComplete) {
        try {
          await fs.rm(file.previous, { force: true });
        } catch (error) {
          log?.warn?.(`VyOps cleanup warning: prior file removal failed: ${error.message}`);
        }
      }
    }
  }
}
