import { fs, log } from '@eliware/common';
import { randomUUID } from 'node:crypto';
import { connect as sharedConnect } from '@eliware/ssh-client';

/* istanbul ignore next -- environment-specific timeout overrides are integration configuration. */
const timeout = (name, fallback) => Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;
const CONNECT_TIMEOUT = timeout('VYOPS_CONNECT_TIMEOUT', 30000);
const OPERATION_TIMEOUT = timeout('VYOPS_OPERATION_TIMEOUT', 60000);
const INTERACTIVE_TIMEOUT = timeout('VYOPS_INTERACTIVE_TIMEOUT', 60000);
const CLOSE_TIMEOUT = 5000;

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

export async function connect(target, { password } = {}) {
  const { username, host } = parseTarget(target);
  log.debug(`[vyops] SSH connecting: ${username}@${host}`);
  const connection = await sharedConnect({ host, username,
    privateKeyPath: password === undefined ? (process.env.VYOPS_SSH_KEY || undefined) : undefined,
    agent: process.env.SSH_AUTH_SOCK, knownHostsPath: process.env.SSH_KNOWN_HOSTS || '~/.ssh/known_hosts',
    hostCaPath: process.env.SSH_HOST_CA, password, connectTimeout: CONNECT_TIMEOUT });
  const client = connection.raw;
  activeClients.add(client);
  log.debug(`[vyops] SSH connected: ${username}@${host}`);
  return client;
}

export function exec(client, command) {
  const operation = randomUUID();
  log.debug(`[vyops] SSH exec [${operation}]: ${command}`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      stream?.close?.();
      reject(new Error(`SSH command timed out [${operation}]: ${command}`));
    }, OPERATION_TIMEOUT);
    let stream;
    client.exec(command, (error, openedStream) => {
      /* istanbul ignore next -- late callbacks require a real SSH transport. */
      if (settled) { openedStream?.close?.(); return; }
      stream = openedStream;
      /* istanbul ignore next -- channel setup errors require transport-specific callbacks. */
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      let stdout = '', stderr = '';
      const finish = (callback, value) => {
        /* istanbul ignore next -- duplicate stream events require a real SSH transport. */
        if (settled) return;
        settled = true;
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
  const operation = randomUUID();
  log.debug(`[vyops] SFTP upload [${operation}]: ${local} -> ${remote}`);
  const data = await fs.promises.readFile(local);
  return new Promise((resolve, reject) => {
    let sftp;
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      sftp?.end?.();
      reject(new Error(`SFTP upload timed out [${operation}]: ${remote}`));
    }, OPERATION_TIMEOUT);
    client.sftp((error, openedSftp) => {
      /* istanbul ignore next -- late callbacks require a real SFTP transport. */
      if (settled) { openedSftp?.end?.(); return; }
      sftp = openedSftp;
      /* istanbul ignore next -- SFTP setup errors require transport-specific callbacks. */
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      sftp.writeFile(remote, data, { mode }, error2 => {
        /* istanbul ignore next -- duplicate SFTP callbacks require a real transport. */
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
      reject(new Error(`SFTP download timed out [${operation}]: ${remote}`));
    }, OPERATION_TIMEOUT);
    client.sftp((error, openedSftp) => {
      /* istanbul ignore next -- late callbacks require a real SFTP transport. */
      if (settled) { openedSftp?.end?.(); return; }
      sftp = openedSftp;
      /* istanbul ignore next -- SFTP setup errors require transport-specific callbacks. */
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      sftp.fastGet(remote, local, error2 => {
        /* istanbul ignore next -- duplicate SFTP callbacks require a real transport. */
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sftp.end?.();
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
      }, INTERACTIVE_TIMEOUT);
      const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
      const title = new RegExp(`${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`, 'g');
      const clean = value => value.replace(ansi, '').replace(title, '').replace(/\r/g, '');
      const failureDetail = value => value.split('\n')
        .map(line => line.trim())
        .find(line => /(?:failed|failure|invalid|error|aborted|pending)/i.test(line))
        ?.replace(/(certificate|private key|key)\s+"[^"]+"/ig, '$1 "[redacted]"')
        .replace(/\s+/g, ' ')
        .slice(0, 240);
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
        if (waiting && typeof currentItem !== 'string' && currentItem.reject?.test(cleaned)) {
          settled = true;
          clearTimeout(timer);
          stream.close();
          const detail = failureDetail(cleaned);
          reject(new Error(`interactive command failed: ${currentItem.command}${detail ? ` (${detail})` : ''}`));
          return;
        }
        const pagerReturn = /No next tag\s*\(press RETURN\)/i.test(cleaned);
        const pager = /(?:^|\n):\s*$/.test(cleaned)
          || /--More--\s*$/i.test(cleaned)
          || pagerReturn;
        log(`state after data: index=${index}, waiting=${waiting}, answering=${answering}, prompt=${prompt(cleaned)}, pager=${pager}, bytes=${text.length}`);
        if (pager) {
          const key = pagerReturn ? '\n' : ' ';
          log(`pager prompt detected; sending ${pagerReturn ? 'return' : 'space'}`);
          stream.write(key);
          log(`write complete: ${pagerReturn ? 'return' : 'space'}`);
          return;
        }
        if (/Proceed\s*\?\s*\[Y\/n\]/i.test(cleaned) && !answering) {
          answering = true;
          log('commit-confirm prompt detected; sending: yes');
          response = '';
          stream.write('yes\n');
          log('write complete: yes');
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
        settled = true;
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
          const finalCommand = commands.at(-1);
          const expectedClose = typeof finalCommand === 'string'
            ? finalCommand === 'exit'
            : finalCommand?.command === 'exit';
          if (commands.length === 0 || (index >= commands.length && expectedClose)) resolve(output);
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
    const timer = setTimeout(done, CLOSE_TIMEOUT);
    client.once('close', () => { clearTimeout(timer); done(); });
    client.once('error', done);
    client.end();
  });
}

export async function closeAll() {
  await Promise.all([...activeClients].map(client => close(client)));
}
