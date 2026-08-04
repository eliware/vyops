import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { connect, download, exec, interactive, upload } from './ssh.mjs';

export function extractCompare(output) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
  const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
  const clean = output.replace(ansi, '').replace(title, '').replace(new RegExp(`${String.fromCharCode(27)}[=><]`, 'g'), '').replace(/\r/g, '');
  const match = clean.match(/# compare\n([\s\S]*?)(?=\n[^\n]*# printf)/)
    ?? clean.match(/(No changes between working and active configurations\.)[\s\S]*?(?=\n[^\n]*# printf)/);
  return match?.[1].replace(/^\[edit\]\s*$/gm, '').trim() ?? '';
}

async function installPostCommitHooks(client, config, log) {
  const hooksDir = join(dirname(config), 'scripts', 'commit', 'post-hooks.d');
  let names;
  try {
    names = (await readdir(hooksDir, { withFileTypes: true }))
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!names.length) return;
  const remoteDir = `/home/vyos/.post-hooks.${process.pid}`;
  const installDir = '/config/scripts/commit/post-hooks.d';
  const made = await exec(client, `sudo mkdir -p ${JSON.stringify(remoteDir)} ${JSON.stringify(installDir)}`);
  if (made.code !== 0) throw new Error(`post-commit hook directory setup failed: ${made.stderr || made.stdout}`.trim());
  try {
    for (const name of names) {
      const local = join(hooksDir, name);
      const remote = `${remoteDir}/${basename(name)}`;
      await upload(client, local, remote);
      const installed = await exec(client, `sudo install -m 755 ${JSON.stringify(remote)} ${JSON.stringify(`${installDir}/${basename(name)}`)}`);
      if (installed.code !== 0) throw new Error(`post-commit hook install failed (${name}): ${installed.stderr || installed.stdout}`.trim());
      log(`installed post-commit hook: ${name}`);
    }
  } finally {
    await exec(client, `rm -rf -- ${JSON.stringify(remoteDir)}`).catch(error => log(`hook cleanup failed: ${error.message}`));
  }
}

export async function deploy({ target, config }) {
  const debug = process.env.VYOPS_DEBUG === 'true';
  const log = message => { if (debug) console.error(`[vyops] ${message}`); };
  log(`connecting: ${target}`);
  const client = await connect(target);
  log('SSH connected');
  const remote = `/home/vyos/.config.deploy.${process.pid}`;
  try {
    log(`uploading config: ${config}`);
    await upload(client, config, remote);
    log(`upload complete: ${remote}`);
    await installPostCommitHooks(client, config, log);
    log('starting interactive deployment sequence');
    const output = await interactive(client, [
      'configure',
      `load ${remote}`,
      "printf '%s\\n' '--- compare ---'",
      'compare',
      "printf '%s\\n' '--- end compare ---'",
      'commit-confirm 5',
      'confirm',
      'save',
      'exit',
      'exit',
    ], log);
    log(`interactive sequence returned (${output.length} bytes)`);
    const compare = extractCompare(output);
    if (compare) process.stdout.write(`${compare}\n`);
    if (/Invalid command|Commit failed|Save failed/i.test(output)) throw new Error('router reported deployment failure');
    log(`syncing live config: /config/config.boot -> ${config}`);
    await download(client, '/config/config.boot', config);
    return 0;
  } finally {
    log('cleaning up remote file');
    await exec(client, `rm -f -- ${JSON.stringify(remote)}`).catch(error => log(`cleanup failed: ${error.message}`));
    client.end();
  }
}
