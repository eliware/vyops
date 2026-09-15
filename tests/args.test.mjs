import { parseArgs } from '../src/args.mjs';

test('parses preflight', () => expect(parseArgs(['preflight', 'config.boot'])).toEqual({ command: 'preflight', config: 'config.boot' }));
test('parses preflight with global switches', () => expect(parseArgs(['--debug', 'preflight', 'config.boot'])).toEqual({ command: 'preflight', config: 'config.boot', debug: true }));

test('parses release switches', () => expect(parseArgs(['release', '--yes', '--force', '--debug', '--verify-binaries', '--password-stdin', 'config.boot'])).toEqual({ command: 'release', config: 'config.boot', yes: true, force: true, debug: true, verifyBinaries: true, passwordStdin: true }));
test('parses every release switch', () => expect(parseArgs(['release', '--yes', '--force', '--debug', '--verify', '--verify-binaries', '--no-pushback', '--no-hooks', '--password-stdin', 'config.boot'])).toEqual({ command: 'release', config: 'config.boot', yes: true, force: true, debug: true, verify: true, verifyBinaries: true, noPushback: true, noHooks: true, passwordStdin: true }));
test('requires force for emergency hook suppression', () => expect(() => parseArgs(['release', '--yes', '--no-hooks', 'config.boot'])).toThrow(/Usage:/));

test('parses backup', () => expect(parseArgs(['backup', 'vyos@router', '/tmp/backup'])).toEqual({ command: 'backup', target: 'vyos@router', config: '/tmp/backup' }));
test('parses backup password mode', () => expect(parseArgs(['backup', '--password-stdin', 'vyos@router', '/tmp/backup'])).toEqual({ command: 'backup', target: 'vyos@router', config: '/tmp/backup', passwordStdin: true }));
test('accepts switches before a command', () => expect(parseArgs(['--debug', '--password-stdin', 'backup', 'vyos@router', '/tmp/backup'])).toEqual({ command: 'backup', target: 'vyos@router', config: '/tmp/backup', debug: true, passwordStdin: true }));

test('rejects legacy syntax', () => expect(() => parseArgs(['--dry-run', 'vyos@router', 'config.boot'])).toThrow(/Usage:/));

test('parses help and version switches', () => {
  expect(parseArgs(['--help'])).toEqual({ help: true });
  expect(parseArgs(['--version'])).toEqual({ version: true });
});

test('rejects missing or extra positional arguments', () => {
  expect(() => parseArgs([])).toThrow(/Usage:/);
  expect(() => parseArgs(['release', 'config.boot'])).toThrow(/Usage:/);
  expect(() => parseArgs(['preflight', 'config.boot', 'extra'])).toThrow(/Usage:/);
  expect(() => parseArgs(['config.boot', 'preflight'])).toThrow(/Usage:/);
  expect(() => parseArgs(['preflight', 'config.boot', 'backup'])).toThrow(/Usage:/);
});

test('rejects unknown switches', () => {
  expect(() => parseArgs(['release', '--bogus', 'config.boot'])).toThrow(/Usage:/);
});
