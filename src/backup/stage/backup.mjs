import { stageBackupScript } from "./script.mjs";
import { writeBackupManifest } from "../write/backup-manifest.mjs";
import { writeDeploymentManifest } from "../write/deployment-manifest.mjs";

export async function stageBackup({
  fs,
  path,
  client,
  staged,
  files,
  directories,
  download,
  exec,
  log,
}) {
  const scripts = path(staged, "scripts");
  await fs.mkdir(path(staged, ".."), { recursive: true });
  await fs.mkdir(staged, { mode: 0o700 });
  await fs.mkdir(scripts, { mode: 0o700 });
  const stagedConfig = path(staged, "config.boot");
  log.debug("[vyops] backup: downloading active configuration");
  await download(client, "/config/config.boot", stagedConfig);
  await fs.chmod(stagedConfig, 0o600);
  for (const file of files) {
    await stageBackupScript({ fs, path, client, scripts, file, download, exec, log });
  }
  await writeBackupManifest(fs, path, staged, files);
  await writeDeploymentManifest(fs, path, staged, directories, files);
  return staged;
}
