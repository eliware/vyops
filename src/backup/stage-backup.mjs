import { stageBackupScript } from "./stage-script.mjs";
import { writeBackupManifest } from "./write-backup-manifest.mjs";

export async function stageBackup({ fs, path, client, staged, files, download, exec, log }) {
  const scripts = path(staged, "scripts");
  await fs.mkdir(path(staged, ".."), { recursive: true });
  await fs.mkdir(staged, { mode: 0o700 });
  await fs.mkdir(scripts, { mode: 0o700 });
  const stagedConfig = path(staged, "config.boot");
  log.debug("[vyops] backup: downloading active configuration");
  await download(client, "/config/config.boot", stagedConfig);
  await fs.chmod(stagedConfig, 0o600);
  for (const name of files) {
    await stageBackupScript({ fs, path, client, scripts, name, download, exec, log });
  }
  await writeBackupManifest(fs, path, staged, files);
  return staged;
}
