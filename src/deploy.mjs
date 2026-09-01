import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { readFile as readLocalFile } from 'node:fs/promises';
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
    const path = (relative ? eliwarePath(relative, entry.name) : entry.name).replaceAll(String.fromCharCode(92), '/');
    if (entry.isDirectory?.()) {
      files.push(...await listScripts(eliwarePath(directory, entry.name), path));
    } else if (entry.isFile?.()) {
      files.push(path);
    }
  }
  return files.sort();
}

async function remotePreflight(client, hasHaproxyHooks = false) {
  const requirements = [
    'command -v sudo',
    'command -v systemctl',
    'test -d /config',
    'test -w /config',
    'test "$(df -Pk /config | awk \'NR==2 {print $4}\')" -gt 10240',
  ];
  /* istanbul ignore next -- HAProxy availability requires a matching live hook bundle. */
  if (hasHaproxyHooks) requirements.push('command -v haproxy');
  const result = await exec(client, `set -e; ${requirements.join(' && ')}`);
  if (result.code !== 0) {
    throw new Error(`remote preflight failed: ${result.stderr || result.stdout || 'router prerequisites are not satisfied'}`.trim());
  }
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
  const manifest = `${remoteDir}/manifest.tsv`;
  const installDir = '/config/scripts';
  const made = await exec(client, `mkdir -p ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)} && printf '%s\\n' 'path\\tpreexisting\\told_mode\\told_sha256\\tnew_mode\\tnew_sha256' > ${JSON.stringify(manifest)}`);
  if (made.code !== 0) throw new Error(`script directory setup failed: ${made.stderr || made.stdout}`.trim());
  try {
    for (const name of names) {
      const local = eliwarePath(scriptsDir, name);
      const remote = `${remoteDir}/${name}`;
      const installed = `${installDir}/${name}`;
      const backup = `${backupDir}/${name}`;
      const parent = eliwarePath(name, '..').replaceAll(String.fromCharCode(92), '/');
      let content = Buffer.alloc(0);
      try { content = await readLocalFile(local); }
      /* istanbul ignore next -- missing files are only possible with a mocked directory listing. */
      catch (error) {
        /* istanbul ignore next -- missing files are only possible with a mocked directory listing. */
        if (error.code !== 'ENOENT') throw error;
      }
      const mode = content.toString('utf8').startsWith('#!') || /\.(?:sh|script|exe)$/i.test(name)
        || /^(?:commit[/\\]post-hooks\.d[/\\])/.test(name)
        ? 0o755
        : (await fs.promises.stat(local)).mode & 0o777;
      const executable = mode & 0o111;
      const binary = /\.exe$/i.test(name);
      const backedUp = await exec(client, `if sudo test -e ${JSON.stringify(installed)}; then sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)} && sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)} && printf '%s\\ttrue\\t%s\\t%s\\t-\\t-\\n' ${JSON.stringify(name)} "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" >> ${JSON.stringify(manifest)}; else printf '%s\\tfalse\\t-\\t-\\t-\\t-\\n' ${JSON.stringify(name)} >> ${JSON.stringify(manifest)}; fi`);
      if (backedUp.code !== 0) throw new Error(`script backup failed (${name}): ${backedUp.stderr || backedUp.stdout}`.trim());
      if (parent !== '.') {
        const remoteParent = `${remoteDir}/${parent}`;
        const remoteParentResult = await exec(client, `mkdir -p ${JSON.stringify(remoteParent)}`);
        if (remoteParentResult.code !== 0) throw new Error(`script upload directory setup failed (${join(parent, name.slice(parent.length + 1))}): ${remoteParentResult.stderr || remoteParentResult.stdout}`.trim());
      }
      await upload(client, local, remote);
      const remoteChecks = executable
        ? ` && sudo test -x ${JSON.stringify(installed)}`
        : '';
      const lineEndingCheck = binary
        ? ''
        : ` && ! sudo grep -q "$(printf '\\r')" ${JSON.stringify(installed)}`;
      const installedResult = await exec(client, `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)} && sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${JSON.stringify(installed)} && printf '%s\\t-\\t-\\t-\\t%s\\t%s\\n' ${JSON.stringify(name)} "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" >> ${JSON.stringify(manifest)}${remoteChecks}${lineEndingCheck}`);
      if (installedResult.code !== 0) throw new Error(`script install failed (${name}): ${installedResult.stderr || installedResult.stdout}`.trim());
      log(`installed script: ${name}`);
    }
  } catch (error) {
    await exec(client, `sudo awk -F '\\t' '$2 == "false" {print $1}' ${JSON.stringify(manifest)} | while IFS= read -r name; do sudo rm -f -- ${JSON.stringify(installDir)}/"$name"; done; sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || true; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(cleanupError => log(`script rollback failed: ${cleanupError.message}`));
    throw error;
  }
  return async (committed, activeClient) => {
    if (committed) {
      await exec(activeClient, `sudo rm -rf -- ${JSON.stringify(backupDir)}; rm -rf -- ${JSON.stringify(remoteDir)}`).catch(error => log(`hook cleanup failed: ${error.message}`));
      return;
    }
    await exec(activeClient, `sudo awk -F '\\t' '$2 == "false" {print $1}' ${JSON.stringify(manifest)} | while IFS= read -r name; do sudo rm -f -- ${JSON.stringify(installDir)}/"$name"; done; sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || true; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`).catch(error => log(`script rollback failed: ${error.message}`));
  };
}

export async function deploy({ target, config, password, noHooks = false, verify = false, hasHaproxyHooks = false }) {
  const debugLog = message => log.debug(`[vyops] ${message}`);
  const phase = name => debugLog(`phase: ${name}`);
  debugLog(`connecting: ${target}`);
  let client = password === undefined ? await connect(target) : await connect(target, { password });
  debugLog('SSH connected');
  let finalizeHooks;
  let hooksFinalized = false;
  let deploymentCommitted = false;
  const runId = randomUUID();
  const remote = `/home/vyos/.config.deploy.${runId}`;
  const manifest = `/home/vyos/.scripts.${runId}/manifest.tsv`;
  try {
    phase('remote preflight');
    await remotePreflight(client, hasHaproxyHooks);
    phase('upload config');
    debugLog(`uploading config: ${config}`);
    await upload(client, config, remote);
    debugLog(`upload complete: ${remote}`);
    phase('upload scripts');
    finalizeHooks = noHooks ? null : await installScripts(client, config, debugLog, runId);
    phase('connect');
    debugLog('reconnecting before interactive deployment sequence');
    await close(client);
    client = null;
    client = password === undefined ? await connect(target) : await connect(target, { password });
    phase('load candidate / compare / commit-confirm / confirm / save');
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
    phase('download synchronized config');
    debugLog('reconnecting after interactive deployment sequence');
    await close(client);
    client = null;
    client = password === undefined ? await connect(target) : await connect(target, { password });
    debugLog(`syncing live config: /config/config.boot -> ${config}`);
    await download(client, '/config/config.boot', config);
    if (finalizeHooks) {
      phase('download deployment manifest');
      await download(client, manifest, `${config}.manifest.tsv`);
    }
    if (verify) {
      for (const command of ['show vrrp', 'show interfaces wireguard', 'show bgp summary', 'show ip route', 'show haproxy']) {
        const result = await exec(client, `vbash -ic ${JSON.stringify(command)}`);
        /* istanbul ignore next -- router command failures require live-router integration. */
        if (result.code !== 0) throw new Error(`verification phase failed (${command}): ${result.stderr || result.stdout}`.trim());
        log.info(`[verify] ${command}\n${result.stdout}`);
      }
    }
    if (finalizeHooks) {
      hooksFinalized = true;
      await finalizeHooks(true, client);
    }
    return 0;
  } catch (error) {
    if (finalizeHooks && !hooksFinalized) {
      try { await finalizeHooks(deploymentCommitted, client); }
      /* Cleanup is best-effort so the original deployment failure remains authoritative. */
      catch (cleanupError) {
        /* istanbul ignore next -- cleanup failures require a live router integration. */
        debugLog(`hook cleanup failed while handling deployment error: ${cleanupError.message}`);
      }
      hooksFinalized = true;
    }
    throw error;
  } finally {
    debugLog('cleaning up remote file');
    /* istanbul ignore else -- the client is retained for cleanup on normal paths. */
    if (client) await exec(client, `rm -f -- ${JSON.stringify(remote)}; rm -rf -- ${JSON.stringify(`/home/vyos/.scripts.${runId}`)} ${JSON.stringify(`/home/vyos/.scripts-backup.${runId}`)}`).catch(error => debugLog(`cleanup failed: ${error.message}`));
    // Await close so the process never exits with an active SSH session.
    await close(client);
  }
}
