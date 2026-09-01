import { backup } from '../src/backup.mjs';
import { deploy } from '../src/deploy.mjs';

const target = process.env.VYOPS_LIVE_TARGET;
const destination = process.env.VYOPS_LIVE_BACKUP_DEST;
const password = process.env.VYOPS_LIVE_PASSWORD;
const liveTest = target && destination ? test : test.skip;

liveTest('backs up the configured live router without mutation', async () => {
  await expect(backup({ target, config: destination, password })).resolves.toBe(0);
});

const releaseTarget = process.env.VYOPS_LIVE_RELEASE_TARGET;
const releaseConfig = process.env.VYOPS_LIVE_RELEASE_CONFIG;
const releasePassword = process.env.VYOPS_LIVE_RELEASE_PASSWORD;
const releaseConfirmed = process.env.VYOPS_LIVE_RELEASE_CONFIRM === 'I_UNDERSTAND';
const releaseTest = releaseTarget && releaseConfig && releaseConfirmed ? test : test.skip;

releaseTest('deploys and verifies the explicitly authorized live router', async () => {
  await expect(deploy({ target: releaseTarget, config: releaseConfig, password: releasePassword, verify: true, noHooks: false }))
    .resolves.toBe(0);
});
