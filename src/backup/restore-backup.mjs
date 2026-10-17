export async function restoreBackup(fs, installed, saved, destination, previous, cause) {
  try {
    for (const name of installed.reverse())
      await fs.rm(`${destination}/${name}`, { recursive: true, force: true });
    for (const name of saved.reverse()) {
      await fs.rm(`${destination}/${name}`, { recursive: true, force: true });
      await fs.rename(`${previous}/${name}`, `${destination}/${name}`);
    }
    await fs.rm(previous, { recursive: true, force: true });
  } catch (restoreError) {
    throw new Error(
      `Backup update failed. Prior files remain in ${previous}: ${restoreError.message}`,
      { cause },
    );
  }
}
