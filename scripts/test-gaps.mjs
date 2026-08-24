import { spawn } from 'node:child_process';

const npm = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const args = process.env.npm_execpath ? [process.env.npm_execpath, 'test'] : ['test'];
const child = spawn(npm, args, { shell: false, stdio: ['inherit', 'pipe', 'pipe'] });
let output = '';

child.stdout.on('data', data => {
  process.stdout.write(data);
  output += data;
});
child.stderr.on('data', data => {
  process.stderr.write(data);
  output += data;
});

child.on('close', code => {
  const gaps = output
    .split(/\r?\n/)
    .filter(line => /^\s*(?:All files|[\w.-]+\.mjs)\s+\|/.test(line)
      && !line.includes('|     100 |      100 |     100 |     100 |'));
  if (gaps.length) process.stdout.write(`\nCoverage gaps:\n${gaps.join('\n')}\n`);
  process.exitCode = code ?? 1;
});
