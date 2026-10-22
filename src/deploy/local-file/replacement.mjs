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
