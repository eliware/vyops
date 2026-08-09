import { fs } from '@eliware/common';
import { Client } from 'ssh2';

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
  if (!/^[A-Za-z0-9._-]+$/.test(username) || !/^(?:\[[0-9A-Fa-f:]+\]|[A-Za-z0-9._:-]+)$/.test(host)) {
    throw new Error('invalid target; expected user@host');
  }
  return { username, host };
}

export async function connect(target) {
  const { username, host } = parseTarget(target);
  const privateKey = await fs.promises.readFile(process.env.VYOPS_SSH_KEY || `${process.env.HOME}/.ssh/id_rsa`);
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => resolve(client));
    client.once('error', reject);
    client.once('close', () => activeClients.delete(client));
    activeClients.add(client);
    client.connect({ host, username, agent: process.env.SSH_AUTH_SOCK, privateKey });
  });
}

export function exec(client, command) {
  return new Promise((resolve, reject) => client.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', data => { stdout += data; });
    stream.stderr.on('data', data => { stderr += data; });
    stream.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
  }));
}

export async function upload(client, local, remote) {
  const data = await fs.promises.readFile(local);
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remote, data, error2 => error2 ? reject(error2) : resolve());
    });
  });
}

export function download(client, remote, local) {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.fastGet(remote, local, error2 => error2 ? reject(error2) : resolve());
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
      const prompt = value => /(?:^|\n)[^\n]*[#>$]\s*$/.test(value);
      const sendNext = () => {
        if (waiting || index >= commands.length) return;
        const command = commands[index++];
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
        if (!settled && !timedOut) resolve(output);
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
