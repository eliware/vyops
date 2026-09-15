import { jest } from '@jest/globals';
import { readManagedPaths, unmanagedPaths } from '../../src/deploy/script-manifest.mjs';

test('reads and validates managed file paths', async () => {
  const readFile = jest.fn().mockResolvedValue('file\thook.sh\tfalse\n');
  await expect(readManagedPaths(readFile, '/tmp/manifest')).resolves.toEqual(new Set(['hook.sh']));
});

test('rejects unsafe manifest paths and tolerates a missing manifest', async () => {
  await expect(readManagedPaths(jest.fn().mockResolvedValue('file\t../escape\tfalse\n'), '/tmp/manifest'))
    .rejects.toThrow('unsafe script path');
  await expect(readManagedPaths(jest.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })), '/tmp/manifest'))
    .resolves.toEqual(new Set());
});

test('finds live files absent from the managed manifest', () => {
  expect(unmanagedPaths('/config/scripts/hook.sh\0/config/scripts/manual.sh\0', new Set(['hook.sh'])))
    .toEqual(['manual.sh']);
});
