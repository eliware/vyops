import { isSafeScriptPath } from "../bundle/script-path-rules.mjs";

export function unmanagedPaths(liveOutput, managed) {
  return liveOutput
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      if (!file.startsWith("/config/scripts/"))
        throw new Error("live script scan returned a path outside /config/scripts");
      const name = file.slice("/config/scripts/".length);
      if (!isSafeScriptPath(name))
        throw new Error("live script scan returned an unsafe script path");
      return name;
    })
    .filter((file) => !managed.has(file));
}
