import { remoteScriptPath } from "./script/path.mjs";
import { validateRemoteScript } from "./script.mjs";
import { inspectRemoteScriptLinks } from "./script/link-inspection.mjs";

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
  const files = result.stdout.split("\0").filter(Boolean).map(remoteScriptPath);
  log.debug(`[vyops] backup: found ${files.length} remote script files`);
  for (const name of files) await validateRemoteScript(exec, client, `/config/scripts/${name}`);
  return files;
}
