import { publishBackupEntries } from "./publication-transaction.mjs";

const entries = ["config.boot", "scripts", "config.boot.manifest.tsv"];

export async function publishBackup(fs, staged, destination, previous, log) {
  await fs.mkdir(destination, { recursive: true });
  await fs.mkdir(previous, { recursive: true });
  await publishBackupEntries(fs, entries, staged, destination, previous);
  try {
    await fs.rm(previous, { recursive: true, force: true });
  } catch (error) {
    log?.warn(`VyOps backup cleanup warning: prior backup removal failed: ${error.message}`);
  }
}
