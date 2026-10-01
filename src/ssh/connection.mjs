import { log } from '@eliware/common';
import { connect as sharedConnect } from '@eliware/ssh-client';
import { EventEmitter } from 'node:events';
import { parseTarget } from './target.mjs';

const timeout = (name, fallback) => Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;

function adaptConnection(connection) {
  const client = new EventEmitter();
  client.__vyopsConnection = connection;
  client.exec = (command, callback) => {
    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    stream.close = () => {};
    callback(null, stream);
    connection.exec([command], { timeout: timeout('VYOPS_OPERATION_TIMEOUT', 60000) })
      .then(([result]) => {
        if (result.stdout) stream.emit('data', Buffer.from(result.stdout));
        if (result.stderr) stream.stderr.emit('data', Buffer.from(result.stderr));
        stream.emit('close', result.code);
      })
      .catch(error => stream.emit('error', error));
  };
  client.shell = (options, callback) => {
    connection.shell(options).then(stream => callback(null, stream), callback);
  };
  client.end = () => {
    connection.close().then(() => client.emit('close'), error => {
      if (client.listenerCount('error')) client.emit('error', error);
      else client.emit('close');
    });
  };
  return client;
}

export async function connect(target, { password, register = () => {} } = {}) {
  const { username, host } = parseTarget(target);
  log.debug(`[vyops] SSH connecting: ${username}@${host}`);
  const connection = await sharedConnect({ host, username,
    privateKeyPath: password === undefined ? (process.env.VYOPS_SSH_KEY || undefined) : undefined,
    agent: process.env.SSH_AUTH_SOCK, knownHostsPath: process.env.SSH_KNOWN_HOSTS || '~/.ssh/known_hosts',
    hostCaPath: process.env.SSH_HOST_CA, password, connectTimeout: timeout('VYOPS_CONNECT_TIMEOUT', 30000) });
  const client = connection.raw || adaptConnection(connection);
  client.__vyopsTarget = target;
  client.__vyopsPhase = 'connect';
  register(client);
  log.debug(`[vyops] SSH connected: ${username}@${host}`);
  return client;
}
