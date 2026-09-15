import { log } from '@eliware/common';
import { connect as sharedConnect } from '@eliware/ssh-client';
import { parseTarget } from './target.mjs';

const timeout = (name, fallback) => Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;

export async function connect(target, { password, register = () => {} } = {}) {
  const { username, host } = parseTarget(target);
  log.debug(`[vyops] SSH connecting: ${username}@${host}`);
  const connection = await sharedConnect({ host, username,
    privateKeyPath: password === undefined ? (process.env.VYOPS_SSH_KEY || undefined) : undefined,
    agent: process.env.SSH_AUTH_SOCK, knownHostsPath: process.env.SSH_KNOWN_HOSTS || '~/.ssh/known_hosts',
    hostCaPath: process.env.SSH_HOST_CA, password, connectTimeout: timeout('VYOPS_CONNECT_TIMEOUT', 30000) });
  const client = connection.raw;
  client.__vyopsTarget = target;
  client.__vyopsPhase = 'connect';
  register(client);
  log.debug(`[vyops] SSH connected: ${username}@${host}`);
  return client;
}
