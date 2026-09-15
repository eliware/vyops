import { jest } from '@jest/globals';
import { localScriptMetadata } from '../../src/deploy/script-validation.mjs';

test('derives executable metadata and binary hashes', async () => {
  const readFile = jest.fn().mockResolvedValue(Buffer.from('#!/bin/sh\n'));
  const metadata = await localScriptMetadata(readFile, jest.fn(), '/tmp/scripts', 'hook.sh');
  expect(metadata).toMatchObject({ mode: 0o755, executable: 0o111, binary: false, localHash: null });
});

test('uses existing mode for non-executable files and tolerates missing content', async () => {
  const readFile = jest.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await expect(localScriptMetadata(readFile, jest.fn().mockResolvedValue({ mode: 0o100640 }), '/tmp/scripts', 'notes.txt'))
    .resolves.toMatchObject({ mode: 0o640, executable: 0, binary: false });
});

test('hashes binary scripts', async () => {
  const metadata = await localScriptMetadata(jest.fn().mockResolvedValue(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), jest.fn(), '/tmp/scripts', 'helper.exe');
  expect(metadata).toMatchObject({ mode: 0o755, executable: 0o111, binary: true });
  expect(metadata.localHash).toMatch(/^[a-f0-9]{64}$/);
});

test('propagates local read failures other than missing files', async () => {
  await expect(localScriptMetadata(jest.fn().mockRejectedValue(new Error('read failed')), jest.fn(), '/tmp/scripts', 'hook.sh'))
    .rejects.toThrow('read failed');
});
