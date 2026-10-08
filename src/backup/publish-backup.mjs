const entries = ["config.boot", "scripts", "config.boot.manifest.tsv"];

export async function publishBackup(fs, staged, destination, previous) {
  await fs.mkdir(destination, { recursive: true });
  await fs.mkdir(previous, { recursive: true });
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
    try {
      for (const name of installed.reverse())
        await fs.rm(`${destination}/${name}`, { recursive: true, force: true });
      for (const name of saved.reverse())
        await fs.rename(`${previous}/${name}`, `${destination}/${name}`);
      await fs.rm(previous, { recursive: true, force: true });
    } catch (restoreError) {
      throw new Error(
        `backup update failed; prior files remain in ${previous}: ${restoreError.message}`,
        { cause: error },
      );
    }
    throw error;
  }
  await fs.rm(previous, { recursive: true, force: true });
}
