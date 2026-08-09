import { parseArgs } from '../src/args.mjs';

test('parses target and config', () => {
  expect(parseArgs(['vyos@core1', '/tmp/config.boot'])).toEqual({ target: 'vyos@core1', config: '/tmp/config.boot' });
});

test('parses dry-run switch', () => {
  expect(parseArgs(['--dry-run', 'vyos@core1', '/tmp/config.boot'])).toEqual({
    target: 'vyos@core1', config: '/tmp/config.boot', dryRun: true,
  });
});

test('parses help and version switches', () => {
  expect(parseArgs(['--help'])).toEqual({ help: true });
  expect(parseArgs(['--version'])).toEqual({ version: true });
});

test('rejects missing or extra positional arguments', () => {
  expect(() => parseArgs([])).toThrow(/Usage:/);
  expect(() => parseArgs(['vyos@core1'])).toThrow(/Usage:/);
  expect(() => parseArgs(['vyos@core1', 'config.boot', 'extra'])).toThrow(/Usage:/);
});
