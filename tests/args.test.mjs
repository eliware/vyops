import { parseArgs } from '../src/args.mjs';

test('parses target and config', () => {
  expect(parseArgs(['vyos@core1', '/tmp/config.boot'])).toEqual({ target: 'vyos@core1', config: '/tmp/config.boot' });
});
