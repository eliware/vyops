import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { jest } from '@jest/globals';
import { validateBundle, targetFromConfig } from '../src/bundle.mjs';

test('extracts the target from native VyOS configuration', () => {
  expect(targetFromConfig('system {\n  host-name router\n  login {\n    user vyos {\n    }\n  }\n}\n')).toBe('vyos@router');
  expect(targetFromConfig('system {\n  host-name "router-one" # comment\n  login {\n    user vyos {\n    }\n  }\n}\n')).toBe('vyos@router-one');
});

test.each([
  ['system {}', 'config does not define system host-name'],
  ['system {\n host-name router\n}', 'expected exactly one system login user; found 0'],
  ['system {\n host-name router\n login {\n user a {\n }\n user b {\n }\n }\n}', 'expected exactly one system login user; found 2'],
  ['system {\n host-name router\n', 'config does not define system host-name'],
])('rejects invalid target configuration', (text, message) => {
  expect(() => targetFromConfig(text)).toThrow(message);
});

async function bundleDirectory() {
  const root = await mkdtemp(join(tmpdir(), 'vyops-bundle-'));
  await mkdir(join(root, 'scripts'), { recursive: true });
  return root;
}

test('traverses nested scripts and excludes directories', async () => {
  const root = await bundleDirectory();
  try {
    await mkdir(join(root, 'scripts', 'nested'));
    await writeFile(join(root, 'scripts', 'nested', 'hook.sh'), '#!/bin/sh\n');
    await writeFile(join(root, 'scripts', 'plain.txt'), 'data\n');
    await expect(validateBundle(join(root, 'config.boot'), 'system {}\n', { extractTarget: false }))
      .resolves.toEqual({ scripts: expect.arrayContaining([expect.objectContaining({ name: 'nested/hook.sh' }), expect.objectContaining({ name: 'plain.txt' })]) });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('treats a non-directory scripts path as a traversal error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-bundle-'));
  try {
    await rm(join(root, 'scripts'), { recursive: true, force: true });
    await writeFile(join(root, 'scripts'), 'not a directory');
    await expect(validateBundle(join(root, 'config.boot'), 'system {}\n', { extractTarget: false })).rejects.toMatchObject({ code: 'ENOTDIR' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test.each([
  ['bad.sh', 'echo bad\n', 0o755, 'no shebang'],
  ['bad.sh', '#!/usr/bin/python\n', 0o755, 'unsupported interpreter'],
  ['bad.sh', '#!/bin/sh\r\necho bad\r\n', 0o755, 'CRLF'],
])('rejects invalid executable script %s', async (name, content, mode, message) => {
  const root = await bundleDirectory();
  try {
    const file = join(root, 'scripts', name);
    await writeFile(file, content);
    await chmod(file, mode);
    await expect(validateBundle(join(root, 'config.boot'), 'system {}\n', { extractTarget: false })).rejects.toThrow(message);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('accepts supported binaries and executable hook names', async () => {
  const root = await bundleDirectory();
  try {
    await mkdir(join(root, 'scripts', 'commit', 'post-hooks.d'), { recursive: true });
    await writeFile(join(root, 'scripts', 'tool.exe'), Buffer.from([0, 1, 2]));
    await writeFile(join(root, 'scripts', 'commit', 'post-hooks.d', 'hook'), '#!/bin/vbash\n');
    await expect(validateBundle(join(root, 'config.boot'), 'system {}\n', { extractTarget: false })).resolves.toMatchObject({ scripts: expect.any(Array) });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('skips symlink-like entries during traversal', async () => {
  const entries = [{ name: 'link.sh', isDirectory: () => false, isFile: () => false }];
  const fsApi = {
    readdir: async () => entries,
    readFile: jest.fn(),
    stat: jest.fn(),
  };
  await expect(validateBundle('/tmp/config.boot', 'system {}\n', { extractTarget: false, fsApi }))
    .resolves.toEqual({ scripts: [] });
  expect(fsApi.readFile).not.toHaveBeenCalled();
});

test('propagates non-missing traversal errors', async () => {
  const fsApi = { readdir: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  await expect(validateBundle('/tmp/config.boot', 'system {}\n', { extractTarget: false, fsApi }))
    .rejects.toThrow('denied');
});

test('validates a bundle configuration without scripts', async () => {
  await expect(validateBundle('/tmp/config.boot', 'system {}\n', { extractTarget: false })).resolves.toEqual({ scripts: [] });
});

test('uses default bundle validation options', async () => {
  const root = await bundleDirectory();
  try {
    const config = join(root, 'config.boot');
    const text = 'system {\n host-name router\n login {\n user vyos {\n }\n }\n}\n';
    await expect(validateBundle(config, text)).resolves.toMatchObject({ target: 'vyos@router', scripts: [] });
  } finally { await rm(root, { recursive: true, force: true }); }
});
