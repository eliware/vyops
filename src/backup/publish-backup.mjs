import { publishBackupEntries } from "./publication-transaction.mjs";

const entries = ["config.boot", "scripts", "config.boot.manifest.tsv"];

export async function publishBackup(fs, staged, destination, previous) {
  await fs.mkdir(destination, { recursive: true });
  await fs.mkdir(previous, { recursive: true });
  await publishBackupEntries(fs, entries, staged, destination, previous);
  await fs.rm(previous, { recursive: true, force: true });
}
