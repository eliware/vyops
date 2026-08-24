import { spawn } from 'node:child_process';

const npm = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, 'audit', '--omit=dev', '--audit-level=moderate']
  : ['audit', '--omit=dev', '--audit-level=moderate'];
const env = { ...process.env, npm_config_ignore_scripts: 'true' };
delete env.npm_config_allow_scripts;
const child = spawn(npm, args, { shell: false, stdio: 'inherit', env });
child.on('close', code => { process.exitCode = code ?? 1; });
