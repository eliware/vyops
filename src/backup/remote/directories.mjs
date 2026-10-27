import { inspectRemoteScriptDirectory } from "./directory.mjs";
import { naturalCompare } from "../../validate/natural-compare.mjs";

export async function inspectRemoteScriptDirectories(exec, client, files) {
  const names = new Set();
  for (const { name } of files) {
    const parts = name.split("/");
    for (let index = 1; index < parts.length; index += 1)
      names.add(parts.slice(0, index).join("/"));
  }
  const directories = [];
  for (const name of [...names].sort(naturalCompare))
    directories.push(await inspectRemoteScriptDirectory(exec, client, name));
  return directories;
}
