import { isSafeScriptPath } from "../../../bundle/script/path-rules.mjs";

export function remoteScriptPath(value) {
  const prefix = "/config/scripts/";
  if (typeof value !== "string" || !value.startsWith(prefix))
    throw new Error(`unsafe remote script path: ${value}`);
  const name = value.slice(prefix.length);
  if (!isSafeScriptPath(name)) throw new Error(`unsafe remote script path: ${value}`);
  return name;
}
