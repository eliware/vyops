export async function cleanupDownloadedFiles(fs, staged, rollbackComplete, log) {
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
