import { extractCompare } from '../src/deploy.mjs';

test('extracts only compare results from the interactive transcript', () => {
  const output = `--- compare ---\n[edit]\nvyos@core1.purinton.us# compare\n[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""\n\nvyos@core1.purinton.us# printf '%s\\n' '--- end compare ---'`;

  expect(extractCompare(output)).toBe([
    '[system login banner]',
    '- post-login "GitOps deployment test v2"',
    '+ post-login ""',
  ].join('\n'));
});


test('removes the configuration mode marker from compare output', () => {
  const output = `--- compare ---\nvyos@core1# compare\n[edit]\n\n[system login banner]\n- post-login "old"\n+ post-login "new"\n\nvyos@core1# printf '%s\\n' '--- end compare ---'`;

  expect(extractCompare(output)).toBe([
    '[system login banner]',
    '- post-login "old"',
    '+ post-login "new"',
  ].join('\n'));
});


test('removes configuration mode marker after no-change output', () => {
  const output = `vyos@core1# compare\nNo changes between working and active configurations.\n\n[edit]\nvyos@core1# printf '%s\\n' '--- end compare ---'`;

  expect(extractCompare(output)).toBe('No changes between working and active configurations.');
});


test('removes ANSI-wrapped configuration mode marker', () => {
  const output = `\x1b[?1h\x1b=\rNo changes between working and active configurations.\x1b[m\r\n\x1b[m\r\n\r\x1b[K\x1b[?1l\x1b>[edit]\nvyos@core1# printf '%s\\n' '--- end compare ---'`;

  expect(extractCompare(output)).toBe('No changes between working and active configurations.');
});
