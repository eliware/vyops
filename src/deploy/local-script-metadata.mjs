import { createHash } from "node:crypto";

export async function localScriptMetadataForContent(content, stat, local, name) {
  const mode =
    content.toString("utf8").startsWith("#!") ||
    /\.(?:sh|script|exe)$/i.test(name) ||
    /^(?:commit[/\\]post-hooks\.d[/\\])/.test(name)
      ? 0o755
      : (await stat(local)).mode & 0o777;
  const binary = /\.exe$/i.test(name);
  return {
    content,
    mode,
    executable: mode & 0o111,
    binary,
    localHash: binary ? createHash("sha256").update(content).digest("hex") : null,
  };
}
