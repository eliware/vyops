import { jest } from '@jest/globals';
const readAndValidateConfig = jest.fn().mockResolvedValue('config');
const validateBundle = jest.fn().mockResolvedValue({ target: 'vyos@router', scripts: ['hook.sh'] });
jest.unstable_mockModule('../../src/validate.mjs', () => ({ readAndValidateConfig }));
jest.unstable_mockModule('../../src/bundle.mjs', () => ({ validateBundle }));
const { runPreflight } = await import('../../src/commands/preflight.mjs');
test('validates and reports bundle details', async () => {
  const log = { info: jest.fn() };
  const args = { config: '/tmp/config.boot' };
  await runPreflight(args, log);
  expect(validateBundle).toHaveBeenCalledWith(args.config, 'config');
  expect(log.info).toHaveBeenCalledWith('Preflight successful: vyos@router (1 script files)');
});
