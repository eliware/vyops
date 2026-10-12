import { isSafeScriptPath } from "./manifest.mjs";

export function validateScript(name, data, mode) {
  validateScriptPath(name);
  const firstLine = data.toString("utf8").split(/\n/, 1)[0].replace(/\r$/, "");
  const binary = /\.exe$/i.test(name);
  if (!binary && data.includes(13)) scriptError(name, "contains CR bytes; convert to LF");
  const executable =
    binary ||
    Boolean(mode & 0o111) ||
    firstLine.startsWith("#!") ||
    /(?:\.sh|\.script)$/i.test(name) ||
    /^(?:commit\/post-hooks\.d\/|vyos-(?:pre|post)config-bootup\.script$)/.test(name);
  if (!executable || binary) return;
  if (!firstLine.startsWith("#!")) scriptError(name, "is executable but has no shebang");
  const interpreter = firstLine.slice(2).trim().split(/\s+/, 1)[0];
  if (!["/bin/sh", "/bin/bash", "/bin/vbash", "/usr/bin/env"].includes(interpreter)) {
    scriptError(name, `uses unsupported interpreter ${interpreter}`);
  }
}

export function validateScriptPath(name) {
  if (!isSafeScriptPath(name)) scriptError(name, "path is invalid");
}

function scriptError(name, message) {
  throw new Error(`preflight failed: scripts/${name} ${message}`);
}
