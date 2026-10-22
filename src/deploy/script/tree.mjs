import { scanTree } from "../../bundle/script/tree/scan.mjs";

export async function listScripts(fs, path, directory) {
  const files = await scanTree(
    directory,
    (current) => fs.promises.readdir(current, { withFileTypes: true }),
    path,
    "",
    "null",
    "throw",
  );
  return files === null ? null : files.map(({ name }) => name).sort();
}
