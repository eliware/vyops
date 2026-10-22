import { scriptExecutablePolicy } from "./executable-policy.mjs";

export function validateScriptContent(name, data, mode) {
  const firstLine = data.toString("utf8").split(/\n/, 1)[0].replace(/\r$/, "");
  const { binary, executable } = scriptExecutablePolicy(name, mode, firstLine);
  if (!binary && data.includes(13)) scriptError(name, "contains CR bytes. Convert to LF.");
  if (!executable || binary) return;
  if (!firstLine.startsWith("#!")) scriptError(name, "is executable but has no shebang");
  const interpreter = firstLine.slice(2).trim().split(/\s+/, 1)[0];
  if (!["/bin/sh", "/bin/bash", "/bin/vbash", "/usr/bin/env"].includes(interpreter)) {
    scriptError(name, `uses unsupported interpreter ${interpreter}`);
  }
}

function scriptError(name, message) {
  throw new Error(`preflight failed: scripts/${name} ${message}`);
}
