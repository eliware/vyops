export async function inspectRemoteScriptLinks(exec, client) {
  const result = await exec(
    client,
    [
      "if [ -L /config/scripts ]",
      "then",
      "  printf '/config/scripts\\0'",
      "  exit 0",
      "fi",
      "if [ ! -e /config/scripts ]",
      "then exit 0",
      "fi",
      "find -P /config/scripts -type l -print0",
    ].join("\n"),
  );
  if (result.code !== 0)
    throw new Error(`could not inspect remote scripts: ${result.stderr || result.stdout}`.trim());
  if (result.stdout) {
    const first = result.stdout.split("\0").filter(Boolean)[0];
    throw new Error(`remote script symlink rejected: ${first}`);
  }
}
