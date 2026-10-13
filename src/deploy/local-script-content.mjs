export async function readLocalScriptContent(readFile, local) {
  try {
    return await readFile(local);
  } catch (error) {
    if (error.code === "ENOENT") return Buffer.alloc(0);
    throw error;
  }
}
