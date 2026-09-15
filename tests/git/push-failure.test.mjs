import { pushFailure } from '../../src/git/push-failure.mjs';

test('reports available push recovery metadata', async () => {
  const git = async ([command]) => ({ stdout: command === 'rev-parse' ? 'abc123\n' : 'main\n' });
  await expect(pushFailure(git, 'repo', Object.assign(new Error('push failed'), { stderr: 'remote rejected' })))
    .resolves.toMatchObject({ message: expect.stringContaining('commit abc123; branch: main') });
});

test('uses safe fallbacks when push recovery metadata is unavailable', async () => {
  const git = async () => { throw new Error('metadata unavailable'); };
  await expect(pushFailure(git, 'repo', new Error('push failed')))
    .resolves.toMatchObject({ message: expect.stringContaining('commit unknown; branch: DETACHED; upstream: (none)') });
});
