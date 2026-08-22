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

async function listScripts(directory, relative = '') {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = relative ? eliwarePath(relative, entry.name) : entry.name;
    if (entry.isDirectory?.()) {
      files.push(...await listScripts(eliwarePath(directory, entry.name), path));
    } else if (entry.isFile?.()) {
      files.push(path);
    }
  }
  return files.sort();
}

async function installScripts(client, config, log, runId) {
  const scriptsDir = eliwarePath(config, '..', 'scripts');
  let names;
  try {
    names = await listScripts(scriptsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!names.length) return null;
  if (names.some(name => !name || name === '.' || name === '..' || name.startsWith('/') || name.split('/').includes('..'))) {
    throw new Error('script path is invalid');
  }
  const remoteDir = `/home/vyos/.scripts.${runId}`;
  const backupDir = `/home/vyos/.scripts-backup.${runId}`;
  const installDir = '/config/scripts';
  const made = await exec(client, `mkdir -p ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)}`);
  if (made.code !== 0) throw new Error(`script directory setup failed: ${made.stderr || made.stdout}`.trim());
  try {
    for (const name of names) {
      const local = eliwarePath(scriptsDir, name);
      const remote = `${remoteDir}/${name}`;
      const installed = `${installDir}/${name}`;
      const backup = `${backupDir}/${name}`;
      const parent = eliwarePath(name, '..');
      const mode = (await fs.promises.stat(local)).mode & 0o777;
      const backedUp = await exec(client, `if sudo test -e ${JSON.stringify(installed)}; then sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)} && sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)}; fi`);
      if (backedUp.code !== 0) throw new Error(`script backup failed (${name}): ${backedUp.stderr || backedUp.stdout}`.trim());
      if (parent !== '.') {
        const remoteParent = `${remoteDir}/${parent}`;
        const remoteParentResult = await exec(client, `mkdir -p ${JSON.stringify(remoteParent)}`);
        if (remoteParentResult.code !== 0) throw new Error(`script upload directory setup failed (${name}): ${remoteParentResult.stderr || remoteParentResult.stdout}`.trim());
      }
      await upload(client, local, remote);
      const installedResult = await exec(client, `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)} && sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${JSON.stringify(installed)}`);
      if (installedResult.code !== 0) throw new Error(`script install failed (${name}): ${installedResult.stderr || installedResult.stdout}`.trim());
      log(`installed script: ${name}`);
    }
  } catch (error) {
    await exec(client, `sudo rm -f -- ${names.map(name => JSON.stringify(`${installDir}/${name}`)).join(' ')}; sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || true; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(cleanupError => log(`script rollback failed: ${cleanupError.message}`));
    throw error;
  }
  return async (committed, activeClient = client) => {
    if (committed) {
      await exec(activeClient, `sudo rm -rf -- ${JSON.stringify(backupDir)}; rm -rf -- ${JSON.stringify(remoteDir)}`).catch(error => log(`hook cleanup failed: ${error.message}`));
      return;
    }
    await exec(activeClient, `sudo rm -f -- ${names.map(name => JSON.stringify(`${installDir}/${name}`)).join(' ')}; sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || true; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(error => log(`script rollback failed: ${error.message}`));
  };
}

export async function deploy({ target, config, password }) {
  const debugLog = message => log.debug(`[vyops] ${message}`);
  debugLog(`connecting: ${target}`);
  let client = password === undefined ? await connect(target) : await connect(target, { password });
  debugLog('SSH connected');
  let finalizeHooks;
  let hooksFinalized = false;
  let deploymentCommitted = false;
  const runId = randomUUID();
  const remote = `/home/vyos/.config.deploy.${runId}`;
  try {
    debugLog(`uploading config: ${config}`);
    await upload(client, config, remote);
    debugLog(`upload complete: ${remote}`);
    finalizeHooks = await installScripts(client, config, debugLog, runId);
    debugLog('reconnecting before interactive deployment sequence');
    await close(client);
    client = password === undefined ? await connect(target) : await connect(target, { password });
    debugLog('starting interactive deployment sequence');
    const output = await interactive(client, [
      'configure',
      { command: `load ${remote}`, reject: /(?:load failed|commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration|error|invalid)/i },
      'run set terminal length 0',
      "printf '%s\\n' '--- compare ---'",
      'compare',
      "printf '%s\\n' '--- end compare ---'",
      { command: 'commit-confirm 5', reject: /(?:commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration)/i },
      { command: 'confirm', reject: /(?:confirm failed|error|invalid)/i },
      { command: 'save', reject: /(?:save failed|error|invalid)/i },
      'exit',
      'exit',
    ], debugLog);
    debugLog(`interactive sequence returned (${output.length} bytes)`);
    deploymentCommitted = true;
    const compare = extractCompare(output);
    if (compare) log.info(compare);
    debugLog(`syncing live config: /config/config.boot -> ${config}`);
    await download(client, '/config/config.boot', config);
    if (finalizeHooks) {
      hooksFinalized = true;
      await finalizeHooks(true, client);
    }
    return 0;
  } catch (error) {
    if (finalizeHooks && !hooksFinalized && !deploymentCommitted) await finalizeHooks(false, client);
    throw error;
  } finally {
    debugLog('cleaning up remote file');
    await exec(client, `rm -f -- ${JSON.stringify(remote)}`).catch(error => debugLog(`cleanup failed: ${error.message}`));
    await close(client);
  }
}
