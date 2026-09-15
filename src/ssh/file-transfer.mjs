import { fs, log } from '@eliware/common';
import { randomUUID } from 'node:crypto';

const timeout = (name, fallback) => Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || 'unknown'} target=${client?.__vyopsTarget || 'unknown'} phase=${client?.__vyopsPhase || 'unknown'}`;
}

function timeoutError(message) {
  const error = new Error(message);
  error.code = 'VYOPS_TIMEOUT';
  return error;
}

export async function upload(client, local, remote, mode = 0o600) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP upload [${operation}]: ${local} -> ${remote}`);
  const data = await fs.promises.readFile(local);
  return new Promise((resolve, reject) => {
    let sftp;
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      sftp?.end?.();
      client.end?.();
      reject(timeoutError(`SFTP upload timed out [${operation}] (${context(client)}): ${remote}`));
    }, timeout('VYOPS_OPERATION_TIMEOUT', 60000));
    client.sftp((error, openedSftp) => {
      if (settled) { openedSftp?.end?.(); return; }
      sftp = openedSftp;
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      sftp.writeFile(remote, data, { mode }, error2 => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sftp.end?.();
        return error2 ? reject(error2) : resolve();
      });
    });
  });
}

export function download(client, remote, local) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP download [${operation}]: ${remote} -> ${local}`);
  return new Promise((resolve, reject) => {
    let sftp;
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      sftp?.end?.();
      client.end?.();
      reject(timeoutError(`SFTP download timed out [${operation}] (${context(client)}): ${remote}`));
    }, timeout('VYOPS_OPERATION_TIMEOUT', 60000));
    client.sftp((error, openedSftp) => {
      if (settled) { openedSftp?.end?.(); return; }
      sftp = openedSftp;
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      sftp.fastGet(remote, local, error2 => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sftp.end?.();
        return error2 ? reject(error2) : resolve();
      });
    });
  });
}
