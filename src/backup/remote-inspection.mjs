import { remoteScriptPath } from "./remote-script-path.mjs";
import { validateRemoteScript } from "./remote-script.mjs";

export async function inspectRemoteScripts(exec, client, log) {
  log.debug("[vyops] backup: inspecting remote script links");
  const links = await exec(
    client,
    "if [ -L /config/scripts ]; then printf '/config/scripts\\0'; exit 0; fi; if [ ! -e /config/scripts ]; then exit 0; fi; find -P /config/scripts -type l -print0",
  );
  if (links.code !== 0)
    throw new Error(`could not inspect remote scripts: ${links.stderr || links.stdout}`.trim());
  if (links.stdout) {
    const first = links.stdout.split("\0").filter(Boolean)[0];
    throw new Error(`remote script symlink rejected: ${first}`);
  }
  const result = await exec(
    client,
    "if [ ! -e /config/scripts ] && [ ! -L /config/scripts ]; then exit 0; fi; find -P /config/scripts -type f -print0",
  );
  if (result.code !== 0)
    throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
  const files = result.stdout.split("\0").filter(Boolean).map(remoteScriptPath);
  log.debug(`[vyops] backup: found ${files.length} remote script files`);
  for (const name of files) await validateRemoteScript(exec, client, `/config/scripts/${name}`);
  return files;
}
