import { validateConfig } from '../src/validate.mjs';

test('accepts native hierarchical config and comments', () => {
  expect(() => validateConfig(`interfaces {\n  ethernet eth0 {\n    address 192.0.2.1/24 # comment\n  }\n}`)).not.toThrow();
});

test.each([
  ['unterminated quote', 'system {\n  host-name "router\n}'],
  ['unexpected closing brace', '}'],
  ['unbalanced braces', 'system {\n  host-name router'],
  ['brace with trailing content', 'system { junk'],
])('rejects %s', (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test('accepts braces and hashes inside quotes', () => {
  expect(() => validateConfig('system {\n  login {\n    banner post-login "hello # { world"\n  }\n}')).not.toThrow();
});
