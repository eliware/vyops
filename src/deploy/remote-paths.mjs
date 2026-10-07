import { posix as posixPath } from "node:path";

export function deploymentRemotePaths(runId) {
  const home = posixPath.join("/", "home", "vyos");
  const scripts = posixPath.join(home, `.scripts.${runId}`);
  return {
    config: posixPath.join(home, `.config.deploy.${runId}`),
    scripts,
    scriptsBackup: posixPath.join(home, `.scripts-backup.${runId}`),
    manifest: posixPath.join(scripts, "manifest.tsv"),
  };
}
