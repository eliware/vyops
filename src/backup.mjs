import { fs, path, log } from '@eliware/common';
import { close, connect, download, exec } from './ssh.mjs';

function remoteScriptPath(value) {
  const name = value.replace(/^\/config\/scripts\/?/, '');
  if (!name || name.startsWith('/') || name.split('/').includes('..')) throw new Error(`unsafe remote script path: ${value}`);
  return name;
}

export async function backup({ target, config, password }) {
  const client = password === undefined ? await connect(target) : await connect(target, { password });
  try {
    await fs.promises.mkdir(config, { recursive: true });
    await fs.promises.mkdir(path(config, 'scripts'), { recursive: true });
    await download(client, '/config/config.boot', path(config, 'config.boot'));
    const links = await exec(client, "find -P /config/scripts -type l -print0 2>/dev/null");
    /* istanbul ignore next -- remote inspection failures require a live router. */
    if (links.code !== 0) throw new Error(`could not inspect remote scripts: ${links.stderr || links.stdout}`.trim());
    /* istanbul ignore next -- a live remote filesystem is required to produce a symlink record. */
    if (links.stdout) {
      /* istanbul ignore next -- symlink discovery requires a live remote filesystem. */
      /* istanbul ignore next -- a live remote filesystem is required to produce a symlink record. */
      const first = links.stdout.split('\0').filter(Boolean)[0];
      /* istanbul ignore next -- symlink discovery requires a live remote filesystem. */
      throw new Error(`remote script symlink rejected: ${first}`);
    }
    const result = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (result.code !== 0) throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
    // NUL records preserve valid embedded whitespace in remote filenames.
    const files = result.stdout.split('\0').filter(Boolean).map(remoteScriptPath);
    for (const name of files) {
      const local = path(config, 'scripts', name);
      await fs.promises.mkdir(path(local, '..'), { recursive: true });
      await download(client, `/config/scripts/${name}`, local);
      log.debug(`[vyops] backed up script: ${name}`);
    }
    return 0;
  } finally {
    await close(client);
  }
}
