export function removeRemoteStaging(exec, client, paths) {
  const command = `rm -f -- ${JSON.stringify(paths.config)}; rm -rf -- ${JSON.stringify(paths.scripts)} ${JSON.stringify(paths.scriptsBackup)}`;
  return exec(client, command);
}
