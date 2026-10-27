import { remoteScriptPath } from "./script/path.mjs";
import { validateRemoteScript } from "./script.mjs";
import { inspectRemoteScriptLinks } from "./script/link-inspection.mjs";
import { inspectRemoteScriptDirectories } from "./directories.mjs";
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
  const directories = await inspectRemoteScriptDirectories(exec, client, files);
  return { files, directories };
}
