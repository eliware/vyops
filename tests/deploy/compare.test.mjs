import { extractCompare } from '../../src/deploy/compare.mjs';

test('extracts only compare results from an interactive transcript', () => {
  const output = `--- compare ---\n[edit]\ntestuser@test-router.example.test# compare\n[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""\n\ntestuser@test-router.example.test# printf '%s\\n' '--- end compare ---'`;
  expect(extractCompare(output)).toBe('[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""');
});

test('handles no changes, ANSI, and unrelated output', () => {
  expect(extractCompare('x\nvyos# compare\n[edit]\n\n[system]\n- old\n+ new\n\nvyos# printf x')).toBe('[system]\n- old\n+ new');
  expect(extractCompare('vyos# compare\nNo changes between working and active configurations.\n\n[edit]\nvyos# printf x')).toBe('No changes between working and active configurations.');
  expect(extractCompare('\x1b[?1h\x1b=\rNo changes between working and active configurations.\x1b[m\r\n\x1b>[edit]\nvyos# printf x')).toBe('No changes between working and active configurations.');
  expect(extractCompare('no compare output')).toBe('');
});
