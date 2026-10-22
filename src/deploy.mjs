import { randomUUID } from "node:crypto";
import { runDeployment } from "./deploy/run.mjs";
import { createDeploymentRuntime } from "./deploy/runtime.mjs";

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
  const runtime = await createDeploymentRuntime({ target, password, operationId });
  const {
    client,
    getClient,
    setClient,
    dependencies,
    redact,
    debugLog,
    phase,
    connectClient,
    runId,
    remotePaths,
    unregisterCleanup,
  } = runtime;
  return runDeployment({
    ...dependencies,
    target,
    config,
    password,
    noHooks,
    verify,
    verifyBinaries,
    hasHaproxyHooks,
    hasBinaryScripts,
    client,
    setClient,
    getClient,
    connectClient,
    remotePaths,
    unregisterCleanup,
    redact,
    debugLog,
    phase,
    runId,
  });
}
