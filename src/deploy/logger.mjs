import { redactSensitiveValues } from "../security/redact.mjs";

export function createDeploymentLogger(log, operationId, password, getClient) {
  const redact = (value) => redactSensitiveValues(value, password);
  const debugLog = (message) => log.debug(`[vyops] [deployment ${operationId}] ${redact(message)}`);
  const phase = (name) => {
    const client = getClient();
    if (client) client.__vyopsPhase = name;
    debugLog(`phase: ${name}`);
  };
  return { redact, debugLog, phase };
}
