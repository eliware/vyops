import { randomUUID } from "node:crypto";
import { shellQuote, snapshotRemoteScript } from "./remote-script.mjs";

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
    const remote = `/config/scripts/${name}`;
    const snapshotDirectory = `/tmp/.vyops-backup.${randomUUID()}`;
    const snapshot = `${snapshotDirectory}/script`;
    const local = path(scripts, name);
    await snapshotRemoteScript(exec, client, remote, snapshotDirectory);
    try {
      await fs.mkdir(path(local, ".."), { recursive: true, mode: 0o700 });
      await download(client, snapshot, local);
      await fs.chmod(local, 0o600);
    } finally {
      await exec(client, `rm -rf -- ${shellQuote(snapshotDirectory)}`);
    }
    log.debug(`[vyops] backed up script: ${name}`);
  }
  const manifest = ["kind\tpath", ...files.map((name) => `file\t${name}`)].join("\n") + "\n";
  await fs.writeFile(path(staged, "config.boot.manifest.tsv"), manifest, {
    encoding: "utf8",
    mode: 0o600,
  });
  return staged;
}
