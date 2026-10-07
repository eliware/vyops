import { randomUUID } from "node:crypto";
import { log } from "@eliware/common";
import { close, connect } from "./ssh.mjs";
import { exec } from "./ssh/exec.mjs";
import { interactive } from "./ssh/interactive.mjs";
import { download } from "./ssh/download.mjs";
import { upload } from "./ssh/upload.mjs";
import { installScripts } from "./deploy/script-sync.mjs";
import { remotePreflight } from "./deploy/preflight.mjs";
import { startDeployment } from "./deploy/start.mjs";
import { runDeployment } from "./deploy/run.mjs";

export { cleanupActiveDeployments } from "./deploy/cleanup.mjs";

export async function deploy(options) {
  const {
    target,
    config,
    password,
    noHooks = false,
    verify = false,
    verifyBinaries = false,
    hasHaproxyHooks = false,
    hasBinaryScripts = false,
    operationId = randomUUID(),
  } = options;
  let client;
  const getClient = () => client;
  const runtime = await startDeployment({
    target,
    password,
    operationId,
    connect,
    close,
    exec,
    log,
    getClient,
    setClient: (value) => {
      client = value;
    },
  });
  const { redact, debugLog, phase, connectClient, runId, remotePaths, unregisterCleanup } = runtime;
  return runDeployment({
    target,
    config,
    password,
    noHooks,
    verify,
    verifyBinaries,
    hasHaproxyHooks,
    hasBinaryScripts,
    client,
    setClient: (value) => {
      client = value;
    },
    getClient,
    close,
    connectClient,
    exec,
    upload,
    download,
    interactive,
    log,
    remotePaths,
    unregisterCleanup,
    redact,
    debugLog,
    phase,
    runId,
    remotePreflight,
    installScripts,
  });
}
