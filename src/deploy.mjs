import { randomUUID } from 'node:crypto';
import { fs, path as eliwarePath, log } from '@eliware/common';
import { close, connect, download, exec, interactive, upload } from './ssh.mjs';

export function extractCompare(output) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
  const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
  const clean = output.replace(ansi, '').replace(title, '').replace(new RegExp(`${String.fromCharCode(27)}[=><]`, 'g'), '').replace(/\r/g, '');
  const match = clean.match(/# compare\n([\s\S]*?)(?=\n[^\n]*# printf)/)
    ?? clean.match(/(No changes between working and active configurations\.)[\s\S]*?(?=\n[^\n]*# printf)/);
  return match?.[1].replace(/^\[edit\]\s*$/gm, '').trim() ?? '';
}

async function installPostCommitHooks(client, config, log, runId) {
  const hooksDir = eliwarePath(config, '..', 'scripts', 'commit', 'post-hooks.d');
  let names;
  try {
    names = (await fs.promises.readdir(hooksDir, { withFileTypes: true }))
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!names.length) return null;
  if (names.some(name => !name || name === '.' || name === '..' || /[\\/]/.test(name))) {
    throw new Error('post-commit hook name is invalid');
  }
  const remoteDir = `/home/vyos/.post-hooks.${runId}`;
  const backupDir = `/home/vyos/.post-hooks-backup.${runId}`;
  const installDir = '/config/scripts/commit/post-hooks.d';
  const made = await exec(client, `mkdir -p ${JSON.stringify(remoteDir)} && sudo mkdir -p ${JSON.stringify(installDir)} ${JSON.stringify(backupDir)}`);
  if (made.code !== 0) throw new Error(`post-commit hook directory setup failed: ${made.stderr || made.stdout}`.trim());
  try {
    for (const name of names) {
      const local = eliwarePath(hooksDir, name);
      const remote = `${remoteDir}/${name}`;
      const installed = `${installDir}/${name}`;
      const backup = `${backupDir}/${name}`;
      const backedUp = await exec(client, `if sudo test -e ${JSON.stringify(installed)}; then sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)}; fi`);
      if (backedUp.code !== 0) throw new Error(`post-commit hook backup failed (${name}): ${backedUp.stderr || backedUp.stdout}`.trim());
      await upload(client, local, remote);
      const installedResult = await exec(client, `sudo install -m 755 ${JSON.stringify(remote)} ${JSON.stringify(installed)}`);
      if (installedResult.code !== 0) throw new Error(`post-commit hook install failed (${name}): ${installedResult.stderr || installedResult.stdout}`.trim());
      log(`installed post-commit hook: ${name}`);
    }
  } catch (error) {
    await exec(client, `sudo rm -f -- ${names.map(name => JSON.stringify(`${installDir}/${name}`)).join(' ')}; for f in ${JSON.stringify(backupDir)}/*; do [ -e "$f" ] && sudo mv -- "$f" ${JSON.stringify(installDir)}/; done; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(cleanupError => log(`hook rollback failed: ${cleanupError.message}`));
    throw error;
  }
  return async committed => {
    if (committed) {
      await exec(client, `sudo rm -rf -- ${JSON.stringify(backupDir)}; rm -rf -- ${JSON.stringify(remoteDir)}`).catch(error => log(`hook cleanup failed: ${error.message}`));
      return;
    }
    await exec(client, `sudo rm -f -- ${names.map(name => JSON.stringify(`${installDir}/${name}`)).join(' ')}; for f in ${JSON.stringify(backupDir)}/*; do [ -e "$f" ] && sudo mv -- "$f" ${JSON.stringify(installDir)}/; done; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(error => log(`hook rollback failed: ${error.message}`));
  };
}

export async function deploy({ target, config }) {
  const debugLog = message => log.debug(`[vyops] ${message}`);
  debugLog(`connecting: ${target}`);
  const client = await connect(target);
  debugLog('SSH connected');
  let finalizeHooks;
  const runId = randomUUID();
  const remote = `/home/vyos/.config.deploy.${runId}`;
  try {
    debugLog(`uploading config: ${config}`);
    await upload(client, config, remote);
    debugLog(`upload complete: ${remote}`);
    finalizeHooks = await installPostCommitHooks(client, config, debugLog, runId);
    debugLog('starting interactive deployment sequence');
    const output = await interactive(client, [
      'configure',
      { command: `load ${remote}`, reject: /(?:load failed|error|invalid)/i },
      "printf '%s\\n' '--- compare ---'",
      'compare',
      "printf '%s\\n' '--- end compare ---'",
      { command: 'commit-confirm 5', reject: /(?:commit failed|error|invalid)/i },
      { command: 'confirm', reject: /(?:confirm failed|error|invalid)/i },
      { command: 'save', reject: /(?:save failed|error|invalid)/i },
      'exit',
      'exit',
    ], debugLog);
    debugLog(`interactive sequence returned (${output.length} bytes)`);
    const compare = extractCompare(output);
    if (compare) log.info(compare);
    if (finalizeHooks) await finalizeHooks(true);
    debugLog(`syncing live config: /config/config.boot -> ${config}`);
    await download(client, '/config/config.boot', config);
    return 0;
  } catch (error) {
    if (finalizeHooks) await finalizeHooks(false);
    throw error;
  } finally {
    debugLog('cleaning up remote file');
    await exec(client, `rm -f -- ${JSON.stringify(remote)}`).catch(error => debugLog(`cleanup failed: ${error.message}`));
    await close(client);
  }
}
