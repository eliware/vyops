import { isSafeScriptPath } from "../bundle/script-path-rules.mjs";

export function remoteScriptPath(value) {
  const name = value.replace(/^\/config\/scripts\/?/, "");
  if (!isSafeScriptPath(name)) throw new Error(`unsafe remote script path: ${value}`);
  return name;
}
