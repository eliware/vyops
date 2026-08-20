import { fs, path, log } from '@eliware/common';
import { close, connect, download, exec } from './ssh.mjs';

function remoteScriptPath(value) {
  const name = value.replace(/^\/config\/scripts\/?/, '');
  if (!name || name.startsWith('/') || name.split('/').includes('..')) throw new Error(`unsafe remote script path: ${value}`);
  return name;
}

export async function backup({ target, config }) {
  const client = await connect(target);
  try {
    await fs.promises.mkdir(config, { recursive: true });
    await fs.promises.mkdir(path(config, 'scripts'), { recursive: true });
    await download(client, '/config/config.boot', path(config, 'config.boot'));
    const result = await exec(client, "find /config/scripts -type f -print 2>/dev/null");
    if (result.code !== 0) throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
    const files = result.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(remoteScriptPath);
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
