import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

export async function downloadToReplace(fs, download, client, remote, local) {
  const temporary = join(dirname(local), `.${basename(local)}.vyops-${randomUUID()}`);
  try {
    await fs.writeFile(temporary, "", { flag: "wx", mode: 0o600 });
    await download(client, remote, temporary);
    await fs.rename(temporary, local);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
