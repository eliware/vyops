export function removeRemoteStaging(exec, client, paths) {
  const temporary = [paths.scripts, paths.scriptsBackup]
    .filter(Boolean)
    .map((path) => JSON.stringify(path))
    .join(" ");
  const command = `rm -f -- ${JSON.stringify(paths.config)} && rm -rf -- ${temporary}`;
  return exec(client, command).then((result) => {
    if (result.code !== 0)
      throw new Error(`remote staging removal failed: ${result.stderr || result.stdout}`);
    return result;
  });
}
