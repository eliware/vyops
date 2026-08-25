import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';

async function filesIn(directory, root = directory) {
  const result = [];
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  for (const entry of entries) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(file, root));
    else if (entry.isFile()) result.push({ file, name: relative(root, file).replaceAll('\\', '/') });
  }
  return result;
}

export function targetFromConfig(text) {
  const host = text.match(/(?:^|\n)\s*host-name\s+(?:"([^"]+)"|'([^']+)'|(\S+))/)?.slice(1).find(Boolean);
  const users = [...text.matchAll(/(?:^|\n)\s*user\s+([A-Za-z0-9._-]+)\s*\{/g)].map(match => match[1]);
  if (!host) throw new Error('preflight failed: config does not define system host-name');
  if (users.length !== 1) throw new Error(`preflight failed: expected exactly one system login user; found ${users.length}`);
  return `${users[0]}@${host}`;
}

function scriptError(name, message) { throw new Error(`preflight failed: scripts/${name} ${message}`); }

export async function validateBundle(config, text, { extractTarget = true } = {}) {
  const scripts = await filesIn(join(config, '..', 'scripts'));
  for (const { file, name } of scripts) {
    const data = await fs.readFile(file);
    const firstLine = data.toString('utf8').split(/\n/, 1)[0].replace(/\r$/, '');
    const binary = /\.exe$/i.test(name);
    const executable = binary || firstLine.startsWith('#!') || /(?:\.sh|\.script)$/.test(name)
      || /^(?:commit\/post-hooks\.d\/|vyos-(?:pre|post)config-bootup\.script$)/.test(name);
    if (!executable) continue;
    if (binary) continue;
    if (data.includes(13)) scriptError(name, 'uses CRLF line endings; convert to LF');
    if (!firstLine.startsWith('#!')) scriptError(name, 'is executable but has no shebang');
    const interpreter = firstLine.slice(2).trim().split(/\s+/, 1)[0];
    if (!['/bin/sh', '/bin/bash', '/bin/vbash', '/usr/bin/env'].includes(interpreter)) {
      scriptError(name, `uses unsupported interpreter ${interpreter}`);
    }
  }
  return { ...(extractTarget ? { target: targetFromConfig(text) } : {}), scripts };
}
