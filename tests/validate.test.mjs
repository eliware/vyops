import { fixConfig, readAndValidateConfig, validateConfig } from '../src/validate.mjs';


test('accepts native hierarchical config and comments', () => {
  expect(() => validateConfig(`interfaces {\n    ethernet eth0 {\n        address 192.0.2.1/24 # comment\n    }\n}`)).not.toThrow();
});

test.each([
  ['unterminated quote', 'system {\n    host-name "router\n}'],
  ['unexpected closing brace', '}'],
  ['unbalanced braces', 'system {\n    host-name router'],
  ['brace with trailing content', 'system { junk'],
])('rejects %s', (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test('accepts braces and hashes inside quotes', () => {
  expect(() => validateConfig('system {\n    login {\n        banner post-login "hello # { world"\n    }\n}')).not.toThrow();
});

test('fixes ordering, whitespace, indentation, and line endings', async () => {
  expect(fixConfig('system {\r\n host-name router  \r\n banner hello\r\n address 192.0.2.1\r\n}\r\n')).toBe(`system {
    host-name router
    banner hello
    address 192.0.2.1
}
`);
});

test.each([
  ['misindented closing brace', 'system {\n    host-name router\n  }'],
  ['extra closing brace', 'system {\n}\n}'],
])('rejects %s', (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test('fixConfig rejects unbalanced or extra braces without truncating', () => {
  expect(() => fixConfig('system {\n  host-name router')).toThrow(/unbalanced braces/);
  expect(() => fixConfig('system {\n}\n}\nother value')).toThrow(/unexpected closing brace/);
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('covers natural ordering comparisons and nested formatting', () => {
  expect(fixConfig(`zeta value\nalpha value\nfoo 10\nfoo 2\nfoo 1\nfoo\nfoo bar\nparent {\n  child 2\n}\nparent {\n  child 1\n}\n`)).toBe(`zeta value\nalpha value\nfoo 10\nfoo 2\nfoo 1\nfoo\nfoo bar\nparent {\n    child 2\n}\nparent {\n    child 1\n}\n`);
});

test('handles blank lines, comments, escaped quotes, and header comments', () => {
  expect(fixConfig(`// generated\n\n# comment\n system {\n  value "escaped \\" quote" # inline\n }\n\n`)).toBe(`# comment\nsystem {\n    value "escaped \\" quote" # inline\n}\n\n\n// generated\n`);
  expect(() => validateConfig('system {\n    value "escaped \\\" quote"\n}')).not.toThrow();
});

test('covers readAndValidateConfig', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-validate-'));
  const path = join(directory, 'config.boot');
  await writeFile(path, 'system {\n    host-name router\n}\n');
  try {
    await expect(readAndValidateConfig(path)).resolves.toBe('system {\n    host-name router\n}\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('sorts consecutive block headers through all natural comparison paths', () => {
  expect(fixConfig(`foo bar {\n}\nfoo {\n}\nfoo 10 {\n}\nfoo 2 {\n}\na b c {\n}\na b {\n}\nalpha {\n}\nbeta {\n}\n`)).toContain('foo {');
});

test('rejects empty, multiple, or malformed braces and comment-only input', () => {
  expect(() => validateConfig('')).toThrow(/file is empty/);
  expect(() => validateConfig('system { junk }')).toThrow(/opening and closing brace/);
  expect(() => validateConfig('system { {')).toThrow(/multiple opening braces/);
  expect(() => validateConfig('system } }')).toThrow(/multiple closing braces/);
  expect(() => validateConfig('# only a comment')).toThrow(/no configuration statements/);
  expect(() => validateConfig('system {\n    value }\n}')).toThrow(/closing brace must be alone/);
});

test('fixConfig rejects an unmatched top-level closing brace', () => {
  expect(() => fixConfig('}')).toThrow(/unexpected closing brace/);
});
