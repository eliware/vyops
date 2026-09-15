import { jest } from '@jest/globals';
import { listScripts } from '../../src/deploy/script-tree.mjs';

test('discovers and sorts nested regular files', async () => {
  const entries = new Map([
    ['root', [{ name: 'nested', isDirectory: () => true, isFile: () => false }, { name: 'z.sh', isDirectory: () => false, isFile: () => true }]],
    ['root/nested', [{ name: 'a.sh', isDirectory: () => false, isFile: () => true }]],
  ]);
  const fs = { promises: { readdir: jest.fn(async directory => entries.get(directory) || []) } };
  const path = (left, right) => `${left}/${right}`;
  await expect(listScripts(fs, path, 'root')).resolves.toEqual(['nested/a.sh', 'z.sh']);
});

test('ignores non-file and non-directory entries', async () => {
  const fs = { promises: { readdir: jest.fn().mockResolvedValue([{ name: 'ignored', isDirectory: () => false, isFile: () => false }]) } };
  await expect(listScripts(fs, () => '', 'root')).resolves.toEqual([]);
});
