import { fixConfig, validateConfig } from '../src/validate.mjs';

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
