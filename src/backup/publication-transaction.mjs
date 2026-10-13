import { restoreBackup } from "./restore-backup.mjs";

export async function publishBackupEntries(fs, entries, staged, destination, previous) {
  const saved = [];
  const installed = [];
  try {
    for (const name of entries) {
      try {
        await fs.rename(`${destination}/${name}`, `${previous}/${name}`);
        saved.push(name);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    for (const name of entries) {
      await fs.rename(`${staged}/${name}`, `${destination}/${name}`);
      installed.push(name);
    }
  } catch (error) {
    await restoreBackup(fs, installed, saved, destination, previous, error);
    throw error;
  }
}
