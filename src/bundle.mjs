import { promises as fs } from "node:fs";
import { join, relative } from "node:path";
import { targetFromConfig } from "./bundle/target.mjs";
import { isSafeScriptPath, validateScriptManifest } from "./bundle/manifest.mjs";

export { targetFromConfig, isSafeScriptPath, validateScriptManifest };

async function filesIn(directory, root, fsApi) {
  const result = [];
  let entries;
  try {
    entries = await fsApi.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return result;
    throw error;
  }
  for (const entry of entries) {
    const file = join(directory, entry.name);
    // Symlinks are intentionally excluded so traversal cannot escape the bundle root.
    if (entry.isDirectory()) result.push(...(await filesIn(file, root, fsApi)));
    else if (entry.isFile())
      result.push({ file, name: relative(root, file).replaceAll("\\", "/") });
  }
  return result;
}

/* SPLIT_TARGET_START */
export async function validateBundle(config, text, { extractTarget = true, fsApi = fs } = {}) {
  const scripts = await filesIn(
    join(config, "..", "scripts"),
    join(config, "..", "scripts"),
    fsApi,
  );
  for (const { file, name } of scripts) {
    if (!isSafeScriptPath(name)) scriptError(name, "path is invalid");
    const data = await fsApi.readFile(file);
    const mode = (await fsApi.stat(file)).mode & 0o777;
    const firstLine = data.toString("utf8").split(/\n/, 1)[0].replace(/\r$/, "");
    const binary = /\.exe$/i.test(name);
    if (!binary && data.includes(13)) scriptError(name, "contains CR bytes; convert to LF");
    const executable =
      binary ||
      Boolean(mode & 0o111) ||
      firstLine.startsWith("#!") ||
      /(?:\.sh|\.script)$/i.test(name) ||
      /^(?:commit\/post-hooks\.d\/|vyos-(?:pre|post)config-bootup\.script$)/.test(name);
    if (!executable) continue;
    if (binary) continue;
    if (!firstLine.startsWith("#!")) scriptError(name, "is executable but has no shebang");
    const interpreter = firstLine.slice(2).trim().split(/\s+/, 1)[0];
    if (!["/bin/sh", "/bin/bash", "/bin/vbash", "/usr/bin/env"].includes(interpreter)) {
      scriptError(name, `uses unsupported interpreter ${interpreter}`);
    }
  }
  return { ...(extractTarget ? { target: targetFromConfig(text) } : {}), scripts };
}
function scriptError(name, message) {
  throw new Error(`preflight failed: scripts/${name} ${message}`);
}
