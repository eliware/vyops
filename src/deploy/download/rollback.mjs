export async function rollbackDownloadedFiles(fs, installed, saved) {
  for (const file of installed.reverse()) await fs.rm(file.local, { force: true, recursive: true });
  for (const file of saved.reverse()) await fs.rename(file.previous, file.local);
}
