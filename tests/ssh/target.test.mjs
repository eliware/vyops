import { parseTarget } from '../../src/ssh/target.mjs';

test.each([
  ['vyos@router.example.test', { username: 'vyos', host: 'router.example.test' }],
  ['admin@[2001:db8::1]', { username: 'admin', host: '[2001:db8::1]' }],
])('parses %s', (target, expected) => {
  expect(parseTarget(target)).toEqual(expected);
});

test.each(['', 'router.example.test', '@router', 'admin@', 'admin@bad host', 'bad/user@router'])('rejects invalid target %s', target => {
  expect(() => parseTarget(target)).toThrow('invalid target; expected user@host');
});
