export async function listScripts(fs, path, directory, relative = "") {
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (!relative && error.code === "ENOENT") return null;
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const name = (relative ? path(relative, entry.name) : entry.name).replaceAll(
      String.fromCharCode(92),
      "/",
    );
    if (entry.isDirectory?.()) {
      files.push(...(await listScripts(fs, path, path(directory, entry.name), name)));
    } else if (entry.isFile?.()) {
      files.push(name);
    }
  }
  return files.sort();
}
