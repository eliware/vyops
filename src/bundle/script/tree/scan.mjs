export async function scanTree(
  directory,
  readEntries,
  joinPath,
  relativeName = "",
  missingRoot = "throw",
  missingNested = "throw",
) {
  let entries;
  try {
    entries = await readEntries(directory);
  } catch (error) {
    if (error.code === "ENOENT") {
      const policy = relativeName ? missingNested : missingRoot;
      if (policy === "empty") return [];
      if (policy === "null") return null;
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const file = joinPath(directory, entry.name);
    const name = (relativeName ? `${relativeName}/${entry.name}` : entry.name).replaceAll(
      "\\",
      "/",
    );
    if (entry.isDirectory?.()) {
      const nested = await scanTree(file, readEntries, joinPath, name, missingRoot, missingNested);
      files.push(...nested);
    } else if (entry.isFile?.()) files.push({ file, name });
  }
  return files;
}
