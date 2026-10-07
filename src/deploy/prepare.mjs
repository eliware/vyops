export async function prepareDeployment(options) {
  const {
    client,
    config,
    remote,
    hasHaproxyHooks,
    hasBinaryScripts,
    noHooks,
    runId,
    verifyBinaries,
    debugLog,
    phase,
    exec,
    upload,
    remotePreflight,
    installScripts,
    redact,
  } = options;
  phase("remote preflight");
  await remotePreflight(exec, client, hasHaproxyHooks, hasBinaryScripts);
  phase("upload config");
  debugLog(`uploading config: ${config}`);
  await upload(client, config, remote);
  debugLog(`upload complete: ${remote}`);
  phase("upload scripts");
  return noHooks ? null : installScripts(client, config, debugLog, runId, verifyBinaries, redact);
}
