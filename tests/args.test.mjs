import { parseArgs } from '../src/args.mjs';

test('parses target and config', () => {
  expect(parseArgs(['testuser@test-router.example.test', '/tmp/config.boot'])).toEqual({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' });
});

test('parses dry-run and force switches', () => {
  expect(parseArgs(['--dry-run', '--force', '--debug', 'testuser@test-router.example.test', '/tmp/config.boot'])).toEqual({
    target: 'testuser@test-router.example.test', config: '/tmp/config.boot', dryRun: true, force: true, debug: true,
  });
});

test('parses backup switch', () => {
  expect(parseArgs(['--backup', 'vyos@router', '/tmp/backup'])).toEqual({
    target: 'vyos@router', config: '/tmp/backup', backup: true,
  });
});

test('parses help and version switches', () => {
  expect(parseArgs(['--help'])).toEqual({ help: true });
  expect(parseArgs(['--version'])).toEqual({ version: true });
});

test('rejects missing or extra positional arguments', () => {
  expect(() => parseArgs([])).toThrow(/Usage:/);
  expect(() => parseArgs(['testuser@test-router.example.test'])).toThrow(/Usage:/);
  expect(() => parseArgs(['testuser@test-router.example.test', 'config.boot', 'extra'])).toThrow(/Usage:/);
});

test('rejects unknown switches', () => {
  expect(() => parseArgs(['--bogus', 'testuser@test-router.example.test', '/tmp/config.boot'])).toThrow(/Usage:/);
});
