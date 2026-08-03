import { connect, download, exec, interactive, upload } from './ssh.mjs';

export function extractCompare(output) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
  const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
  const clean = output.replace(ansi, '').replace(title, '').replace(new RegExp(`${String.fromCharCode(27)}[=><]`, 'g'), '').replace(/\r/g, '');
  const match = clean.match(/# compare\n([\s\S]*?)(?=\n[^\n]*# printf)/)
    ?? clean.match(/(No changes between working and active configurations\.)[\s\S]*?(?=\n[^\n]*# printf)/);
  return match?.[1].replace(/^\[edit\]\s*$/gm, '').trim() ?? '';
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
