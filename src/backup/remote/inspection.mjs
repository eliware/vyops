import { remoteScriptPath } from "./script/path.mjs";
import { validateRemoteScript } from "./script.mjs";
import { inspectRemoteScriptLinks } from "./script/link-inspection.mjs";
import { inspectRemoteScriptDirectory } from "./directory.mjs";
import { naturalCompare } from "../../validate/natural-compare.mjs";

export async function inspectRemoteScripts(exec, client, log) {
  log.debug("[vyops] backup: inspecting remote script links");
  await inspectRemoteScriptLinks(exec, client);
  const result = await exec(
    client,
    [
      "if [ ! -e /config/scripts ] && [ ! -L /config/scripts ]",
      "then exit 0",
      "fi",
      "find -P /config/scripts -type f -print0",
    ].join("\n"),
  );
  if (result.code !== 0)
    throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
  const names = result.stdout
    .split("\0")
    .filter(Boolean)
    .map(remoteScriptPath)
    .sort(naturalCompare);
  log.debug(`[vyops] backup: found ${names.length} remote script files`);
  const files = [];
  for (const name of names) {
    const metadata = await validateRemoteScript(exec, client, `/config/scripts/${name}`);
    files.push({ name, ...metadata });
  }
  const directoryNames = new Set();
  for (const { name } of files) {
    const parts = name.split("/");
    for (let index = 1; index < parts.length; index += 1)
      directoryNames.add(parts.slice(0, index).join("/"));
  }
  const directories = [];
  for (const name of [...directoryNames].sort(naturalCompare))
    directories.push(await inspectRemoteScriptDirectory(exec, client, name));
  return { files, directories };
}
