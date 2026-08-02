import { access } from 'node:fs/promises';
import { parseArgs } from './args.mjs';
import { deploy } from './deploy.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  await access(args.config);
  await deploy(args);
  console.log('Deployment successful');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
