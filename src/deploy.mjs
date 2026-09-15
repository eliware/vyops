import { randomUUID } from 'node:crypto';
import { log } from '@eliware/common';
import { close, connect, download, exec, interactive, upload } from './ssh.mjs';
import { extractCompare } from './deploy/compare.mjs';
import { remotePreflight } from './deploy/preflight.mjs';
import { registerDeploymentCleanup } from './deploy/cleanup.mjs';
import { installScripts } from './deploy/script-sync.mjs';

export { cleanupActiveDeployments } from './deploy/cleanup.mjs';

export async function deploy({ target, config, password, noHooks = false, verify = false, verifyBinaries = false, hasHaproxyHooks = false, hasBinaryScripts = false, operationId = randomUUID() }) {
  const redact = value => String(value)
    .replaceAll(password || '', password ? '[redacted]' : '')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[private-key redacted]')
    .replace(/\b(password|passwd|secret|token|community)\s*(?:=|:)\s*(?:"[^"]*"|'[^']*'|[^\s,;)}]+)/gi, '$1=[redacted]')
    .replace(/\b(password|passwd|secret|token|community)\s+(?![\w-]+:)(?:"[^"]*"|'[^']*'|[^\s,;)}]+)/gi, '$1 [redacted]')
    .replace(/\b(authorization|x-api-key|api[-_ ]?key|private[-_ ]?key)\s*:\s*\S+/gi, '$1: [redacted]')
    .replace(/\b[\w-]*key\s*:\s*\S+/gi, '[redacted]');
  const debugLog = message => log.debug(`[vyops] [deployment ${operationId}] ${redact(message)}`);
  let client;
  const phase = name => {
    if (client) client.__vyopsPhase = name;
    debugLog(`phase: ${name}`);
  };
  phase('connect');
  debugLog(`connecting: ${target}`);
  const connectClient = async () => {
    const connected = password === undefined ? await connect(target) : await connect(target, { password });
    connected.__vyopsDeploymentId = operationId;
    connected.__vyopsPhase = 'connect';
    return connected;
  };
  client = await connectClient();
  debugLog('SSH connected');
  let finalizeHooks;
  let hooksFinalized = false;
  let deploymentCommitted = false;
  const runId = randomUUID();
  const remote = `/home/vyos/.config.deploy.${runId}`;
  const manifest = `/home/vyos/.scripts.${runId}/manifest.tsv`;
  const scriptsRemote = `/home/vyos/.scripts.${runId}`;
  const backupRemote = `/home/vyos/.scripts-backup.${runId}`;
  const interruptedCleanup = async () => {
    const interruptedClient = client;
    let recoveryClient;
    try {
      await close(interruptedClient);
      recoveryClient = await connectClient();
      await exec(recoveryClient, `rm -f -- ${JSON.stringify(remote)}; rm -rf -- ${JSON.stringify(scriptsRemote)} ${JSON.stringify(backupRemote)}`);
    } catch (error) {
      log.warn(`VyOps cleanup warning: interruption cleanup failed for ${target}: ${error.message}`);
    } finally {
      await close(recoveryClient);
    }
  };
  const unregisterCleanup = registerDeploymentCleanup(interruptedCleanup);
  try {
    phase('remote preflight');
    await remotePreflight(exec, client, hasHaproxyHooks, hasBinaryScripts);
    phase('upload config');
    debugLog(`uploading config: ${config}`);
    await upload(client, config, remote);
    debugLog(`upload complete: ${remote}`);
    phase('upload scripts');
    finalizeHooks = noHooks ? null : await installScripts(client, config, debugLog, runId, verifyBinaries, redact);
    phase('connect');
    debugLog('reconnecting before interactive deployment sequence');
    await close(client);
    client = null;
    client = await connectClient();
    debugLog('starting interactive deployment sequence');
    let commitConfirmed = false;
    const output = await interactive(client, [
      'configure',
      { phase: 'load candidate', command: `load ${remote}`, reject: /(?:load failed|commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration|error|invalid)/i },
      'run set terminal length 0',
      { phase: 'compare', command: "printf '%s\\n' '--- compare ---'" },
      { phase: 'compare', command: 'compare' },
      "printf '%s\\n' '--- end compare ---'",
      { phase: 'commit-confirm', command: 'commit-confirm 5', reject: /(?:commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration)/i },
      { phase: 'confirm', command: 'confirm', reject: /(?:confirm failed|error|invalid)/i },
      { phase: 'save', command: 'save', reject: /(?:save failed|error|invalid)/i },
      'exit',
      'exit',
    ], debugLog, command => {
      if (command === 'confirm') {
        commitConfirmed = true;
        deploymentCommitted = true;
      }
    });
    debugLog(`interactive sequence returned (${output.length} bytes)`);
    if (!commitConfirmed) throw new Error('interactive deployment completed without confirming the commit');
    deploymentCommitted = true;
    const compare = extractCompare(output);
    if (compare) log.info(redact(compare));
    phase('download synchronized config');
    debugLog('reconnecting after interactive deployment sequence');
    await close(client);
    client = null;
        client = await connectClient();
    debugLog(`syncing live config: /config/config.boot -> ${config}`);
    await download(client, '/config/config.boot', config);
    if (finalizeHooks) {
      phase('download deployment manifest');
      await download(client, manifest, `${config}.manifest.tsv`);
    }
    if (verify) {
      for (const command of ['show vrrp', 'show interfaces wireguard', 'show bgp summary', 'show ip route', 'show haproxy']) {
        const result = await exec(client, `vbash -ic ${JSON.stringify(command)}`);
        // codescope ignore: next router command failures require live-router integration.
        if (result.code !== 0) throw new Error(`verification phase failed (${command}): ${redact(result.stderr || result.stdout)}`.trim());
        log.info(redact(`[verify] ${command}\n${result.stdout}`));
      }
    }
    phase('run hooks');
    if (finalizeHooks) {
      hooksFinalized = true;
      await finalizeHooks(true, client);
    }
    return 0;
  } catch (error) {
    debugLog(`${error.code === 'VYOPS_TIMEOUT' ? 'timeout' : 'transport'} recovery: discarding SSH client for ${target}`);
    await close(client);
    client = null;
    try {
      debugLog(`recovery: reconnecting SSH client for ${target}`);
      client = await connectClient();
    } catch (reconnectError) {
      debugLog(`recovery reconnect failed: ${reconnectError.message}`);
    }
    if (finalizeHooks && !hooksFinalized) {
      let cleanupClient = client;
      if (!cleanupClient) cleanupClient = await connectClient();
      await finalizeHooks(deploymentCommitted, cleanupClient);
      if (cleanupClient && cleanupClient !== client) await close(cleanupClient);
      hooksFinalized = true;
    }
    throw error;
  } finally {
    unregisterCleanup();
    debugLog('cleaning up remote file');
    let cleanupClient = client;
    try {
      if (!cleanupClient) cleanupClient = await connectClient();
      await exec(cleanupClient, `rm -f -- ${JSON.stringify(remote)}; rm -rf -- ${JSON.stringify(`/home/vyos/.scripts.${runId}`)} ${JSON.stringify(`/home/vyos/.scripts-backup.${runId}`)}`);
    } catch (cleanupError) {
      log.warn(`VyOps cleanup warning: remote staging cleanup could not be completed: ${cleanupError.message}`);
    }
    // Await close so the process never exits with an active SSH session.
    await close(cleanupClient);
  }
}
