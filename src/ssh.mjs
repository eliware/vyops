import { log } from '@eliware/common';
import { randomUUID } from 'node:crypto';
import { connect as establishConnection } from './ssh/connection.mjs';

export { parseTarget } from './ssh/target.mjs';
export { upload, download } from './ssh/file-transfer.mjs';

// codescope ignore: next environment-specific timeout overrides are integration configuration.
const timeout = (name, fallback) => Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;
const CLOSE_TIMEOUT = 5000;

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || 'unknown'} target=${client?.__vyopsTarget || 'unknown'} phase=${client?.__vyopsPhase || 'unknown'}`;
}

function commandSummary(command) {
  const text = String(command).trim();
  const first = text.split(/\s+/, 1)[0] || '(empty)';
  return text === first ? first : `${first} [arguments redacted]`;
}

function timeoutError(message, _client) {
  const error = new Error(message);
  error.code = 'VYOPS_TIMEOUT';
  return error;
}

export async function connect(target, options = {}) {
  return establishConnection(target, { ...options, register: client => activeClients.add(client) });
}

export function exec(client, command) {
  const operation = randomUUID();
  log.debug(`[vyops] SSH exec [${operation}]: ${commandSummary(command)}`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      stream?.close?.();
      client.end?.();
      reject(timeoutError(`SSH command timed out [${operation}] (${context(client)}): ${commandSummary(command)}`, client));
    }, timeout('VYOPS_OPERATION_TIMEOUT', 60000));
    let stream;
    client.exec(command, (error, openedStream) => {
      // codescope ignore: next late callback requires a real SSH transport.
      if (settled) { openedStream?.close?.(); return; }
      stream = openedStream;
      // codescope ignore: next channel setup error requires a transport-specific callback.
      if (error) { settled = true; clearTimeout(timer); return reject(error); }
      let stdout = '', stderr = '';
      const finish = (callback, value) => {
        // codescope ignore: next duplicate stream event requires a real SSH transport.
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

export function interactive(client, commands, log = () => {}, onCommandComplete = () => {}) {
  const operation = randomUUID();
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
        client.end?.();
        const command = currentItem ? (typeof currentItem === 'string' ? currentItem : currentItem.command) : 'none';
        reject(timeoutError(`Interactive SSH timed out [${operation}] (${context(client)}): ${command}`, client));
      }, timeout('VYOPS_INTERACTIVE_TIMEOUT', 60000));
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
        if (item && typeof item === 'object' && item.phase) {
          client.__vyopsPhase = item.phase;
          log(`phase: ${item.phase}`);
        }
        const command = typeof item === 'string' ? item : item.command;
        response = '';
        waiting = true;
        log(`send [${index}/${commands.length}]: ${command}`);
        log(`state before send: index=${index}, waiting=${waiting}, answering=${answering}`);
        stream.write(`${command}\n`);
        log(`write complete [${index}/${commands.length}]`);
      };
      stream.on('data', data => {
        if (settled || timedOut) return;
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
          onCommandComplete(typeof currentItem === 'string' ? currentItem : currentItem.command);
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
        stream.close?.();
        client.end?.();
        reject(error);
      });
      stream.stderr.on('data', data => {
        const text = data.toString();
        output += text;
        response += text;
        log(`recv stderr (${text.length} bytes): ${JSON.stringify(text)}`);
        if (waiting && typeof currentItem !== 'string' && currentItem.reject?.test(clean(response))) {
          settled = true;
          clearTimeout(timer);
          stream.close();
          client.end?.();
          const detail = failureDetail(clean(response));
          reject(new Error(`interactive command failed: ${currentItem.command}${detail ? ` (${detail})` : ''}`));
        }
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
