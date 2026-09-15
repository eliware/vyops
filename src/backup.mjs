import { fs, path, log } from '@eliware/common';
import { randomUUID } from 'node:crypto';
import { close, connect, download, exec } from './ssh.mjs';
import { remoteScriptPath, shellQuote, snapshotRemoteScript } from './backup/remote-script.mjs';

export async function backup({ target, config, password }) {
  const client = password === undefined ? await connect(target) : await connect(target, { password });
  try {
    await fs.promises.mkdir(config, { recursive: true });
    await fs.promises.mkdir(path(config, 'scripts'), { recursive: true });
    await download(client, '/config/config.boot', path(config, 'config.boot'));
    const links = await exec(client, "find -P /config/scripts -type l -print0 2>/dev/null");
    // codescope ignore: next remote inspection failure requires a live router.
    if (links.code !== 0) throw new Error(`could not inspect remote scripts: ${links.stderr || links.stdout}`.trim());
    // codescope ignore: next symlink discovery requires a live remote filesystem.
    if (links.stdout) {
      // codescope ignore: next symlink discovery requires a live remote filesystem.
      const first = links.stdout.split('\0').filter(Boolean)[0];
      throw new Error(`remote script symlink rejected: ${first}`);
    }
    const result = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (result.code !== 0) throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
    // NUL records preserve valid embedded whitespace in remote filenames.
    const files = result.stdout.split('\0').filter(Boolean).map(remoteScriptPath);
    for (const name of files) {
      const remote = `/config/scripts/${name}`;
      const snapshot = `/tmp/.vyops-backup.${randomUUID()}`;
      await snapshotRemoteScript(exec, client, remote, snapshot);
      const local = path(config, 'scripts', name);
      await fs.promises.mkdir(path(local, '..'), { recursive: true });
      try {
        await download(client, snapshot, local);
      } finally {
        await exec(client, `rm -f -- ${shellQuote(snapshot)}`);
      }
      log.debug(`[vyops] backed up script: ${name}`);
    }
    return 0;
  } finally {
    await close(client);
  }
}
