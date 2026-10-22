import { join, relative } from "node:path";

export async function filesIn(directory, root, fsApi) {
  const result = [];
  let entries;
  try {
    entries = await fsApi.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return result;
    throw error;
  }
  for (const entry of entries) {
    const file = join(directory, entry.name);
    // Symlinks are intentionally excluded so traversal cannot go outside the bundle root.
    if (entry.isDirectory()) result.push(...(await filesIn(file, root, fsApi)));
    else if (entry.isFile())
      result.push({ file, name: relative(root, file).replaceAll("\\", "/") });
  }
  return result;
}
