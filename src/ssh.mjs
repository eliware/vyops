import { createHmac } from 'node:crypto';
import { fs, log } from '@eliware/common';
import ssh2 from 'ssh2';

const { Client, utils } = ssh2;

const CONNECT_TIMEOUT = 30000;
const OPERATION_TIMEOUT = 60000;

export function parseTarget(target) {
  if (typeof target !== 'string' || !target || /\s/.test(target)) {
    throw new Error('invalid target; expected user@host');
  }
  const at = target.indexOf('@');
  if (at <= 0 || at !== target.lastIndexOf('@') || at === target.length - 1) {
    throw new Error('invalid target; expected user@host');
  }
  const username = target.slice(0, at);
  const host = target.slice(at + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(username) || !/^(?:\[[0-9A-Fa-f]*:[0-9A-Fa-f:]+\]|(?!\[)[A-Za-z0-9._:-]+)$/.test(host)) {
    throw new Error('invalid target; expected user@host');
  }
  return { username, host };
}

function wildcardMatch(pattern, value) {
  const expression = `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(expression).test(value);
}

function hostMatches(pattern, hosts) {
  if (pattern.startsWith('|1|')) {
    const [, , salt, digest] = pattern.split('|');
    if (!salt || !digest) return false;
    return hosts.some(host => createHmac('sha1', Buffer.from(salt, 'base64')).update(host).digest('base64') === digest);
  }
  return hosts.some(host => wildcardMatch(pattern, host));
}

function keyMatches(expected, actual) {
  try {
    const parsed = utils.parseKey(`${expected.type} ${expected.data}`);
    return parsed.getPublicSSH().equals(actual);
  } catch {
    return false;
  }
}

function verifyKnownHost(host, key, knownHosts) {
  const hosts = [host, `[${host}]:22`];
  let matched = false;
  for (const line of knownHosts.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const fields = trimmed.split(/\s+/);
    if (fields[0].startsWith('@')) {
      if (fields[0] === '@revoked' && fields[1]?.split(',').some(pattern => hostMatches(pattern, hosts))) return false;
      continue;
    }
    if (fields.length < 3) continue;
    const [hostList, type, data] = fields;
    const patterns = hostList.split(',');
    if (patterns.some(pattern => pattern.startsWith('!') && hostMatches(pattern.slice(1), hosts))) return false;
    if (patterns.some(pattern => !pattern.startsWith('!') && hostMatches(pattern, hosts))
      && keyMatches({ type, data }, key)) matched = true;
  }
  return matched;
}

export async function connect(target) {
  const { username, host } = parseTarget(target);
  log.debug(`[vyops] SSH connecting: ${username}@${host}`);
  const privateKey = await fs.promises.readFile(process.env.VYOPS_SSH_KEY || `${process.env.HOME}/.ssh/id_rsa`);
  const knownHostsPath = `${process.env.HOME}/.ssh/known_hosts`;
  const knownHosts = await fs.promises.readFile(knownHostsPath, 'utf8');
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => { log.debug(`[vyops] SSH connected: ${username}@${host}`); resolve(client); });
    client.once('error', reject);
    client.once('close', () => activeClients.delete(client));
    activeClients.add(client);
    client.connect({
      host,
      username,
      agent: process.env.SSH_AUTH_SOCK,
      privateKey,
      hostVerifier: (key, callback) => callback(verifyKnownHost(host, key, knownHosts)),
      readyTimeout: CONNECT_TIMEOUT,
      authTimeout: CONNECT_TIMEOUT,
    });
  });
}

export function exec(client, command) {
  log.debug(`[vyops] SSH exec: ${command}`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SSH command timed out: ${command}`)), OPERATION_TIMEOUT);
    client.exec(command, (error, stream) => {
      if (error) { clearTimeout(timer); return reject(error); }
      let stdout = '', stderr = '';
      const finish = (callback, value) => {
        clearTimeout(timer);
        callback(value);
      };
      stream.on('data', data => { stdout += data; });
      stream.stderr.on('data', data => { stderr += data; });
      stream.on('error', error2 => finish(reject, error2));
      stream.on('close', code => finish(resolve, { code: code ?? 1, stdout, stderr }));
    });
  });
}

export async function upload(client, local, remote, mode = 0o600) {
  log.debug(`[vyops] SFTP upload: ${local} -> ${remote}`);
  const data = await fs.promises.readFile(local);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SFTP upload timed out: ${remote}`)), OPERATION_TIMEOUT);
    client.sftp((error, sftp) => {
      if (error) { clearTimeout(timer); return reject(error); }
      sftp.writeFile(remote, data, { mode }, error2 => {
        clearTimeout(timer);
        return error2 ? reject(error2) : resolve();
      });
    });
  });
}

export function download(client, remote, local) {
  log.debug(`[vyops] SFTP download: ${remote} -> ${local}`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SFTP download timed out: ${remote}`)), OPERATION_TIMEOUT);
    client.sftp((error, sftp) => {
      if (error) { clearTimeout(timer); return reject(error); }
      sftp.fastGet(remote, local, error2 => {
        clearTimeout(timer);
        return error2 ? reject(error2) : resolve();
      });
    });
  });
}

export function interactive(client, commands, log = () => {}) {
  return new Promise((resolve, reject) => {
    client.shell({ term: 'xterm', cols: 160, rows: 48 }, (error, stream) => {
      if (error) return reject(error);
      log('VyOS interactive shell opened');
      let output = '';
      let response = '';
      let index = 0;
      let waiting = false;
      let answering = false;
      let settled = false;
      let timedOut = false;
      let currentItem;
      log(`interactive sequence start (${commands.length} commands)`);
      const timer = setTimeout(() => {
        log(`timeout; next command: ${index + 1}/${commands.length}; waiting=${waiting}; answering=${answering}`);
        log(`partial response:\n${response}`);
        timedOut = true;
        settled = true;
        stream.close();
        reject(new Error('interactive SSH timeout'));
      }, 60000);
      const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
      const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
      const clean = value => value.replace(ansi, '').replace(title, '').replace(/\r/g, '');
      const prompt = value => /(?:^|\n)[A-Za-z0-9._-]+@[A-Za-z0-9._:-]+(?::~\$|#)\s*$/.test(value);
      const sendNext = () => {
        if (waiting || index >= commands.length) return;
        currentItem = commands[index++];
        const item = currentItem;
        const command = typeof item === 'string' ? item : item.command;
        response = '';
        waiting = true;
        log(`send [${index}/${commands.length}]: ${command}`);
        log(`state before send: index=${index}, waiting=${waiting}, answering=${answering}`);
        stream.write(`${command}\n`);
        log(`write complete [${index}/${commands.length}]`);
      };
      stream.on('data', data => {
        const text = data.toString();
        output += text;
        response += text;
        log(`recv (${text.length} bytes): ${JSON.stringify(text)}`);
        const cleaned = clean(response);
        const pager = /(?:^|\n):\s*$/.test(cleaned) || /--More--\s*$/i.test(cleaned);
        log(`state after data: index=${index}, waiting=${waiting}, answering=${answering}, prompt=${prompt(cleaned)}, pager=${pager}, bytes=${text.length}`);
        if (pager) {
          log('pager prompt detected; sending space');
          stream.write(' ');
          log('write complete: space');
          return;
        }
        if (/Proceed\s*\?\s*\[Y\/n\]/i.test(cleaned) && !answering) {
          answering = true;
          log('commit-confirm prompt detected; sending: y');
          response = '';
          stream.write('y\n');
          log('write complete: y');
          return;
        }
        const commandComplete = waiting
          && prompt(cleaned)
          && !/Proceed\s*\?\s*\[Y\/n\]/i.test(cleaned);
        log(`command completion check: complete=${commandComplete}`);
        if (commandComplete) {
          answering = false;
          waiting = false;
          log(`response [${index}]:\n${cleaned}`);
          if (typeof currentItem !== 'string' && currentItem.reject?.test(cleaned)) {
            settled = true;
            clearTimeout(timer);
            stream.close();
            reject(new Error(`interactive command failed: ${currentItem.command}`));
            return;
          }
          if (index >= commands.length) {
            settled = true;
            clearTimeout(timer);
            stream.end();
            resolve(output);
          } else sendNext();
        }
      });
      stream.on('error', error => {
        log(`interactive stream error: ${error.message}`);
        clearTimeout(timer);
        reject(error);
      });
      stream.stderr.on('data', data => {
        const text = data.toString();
        output += text;
        response += text;
        log(`recv stderr (${text.length} bytes): ${JSON.stringify(text)}`);
      });
      stream.on('close', () => {
        log(`VyOS interactive shell closed; settled=${settled}; index=${index}/${commands.length}`);
        clearTimeout(timer);
        if (!settled && !timedOut) {
          if (commands.length === 0) resolve(output);
          else reject(new Error('interactive SSH closed before command sequence completed'));
        }
      });
      sendNext();
    });
  });
}

const activeClients = new Set();

export function close(client) {
  if (!client) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      activeClients.delete(client);
      resolve();
    };
    client.once('close', done);
    client.once('error', done);
    client.end();
  });
}

export async function closeAll() {
  await Promise.all([...activeClients].map(client => close(client)));
}
