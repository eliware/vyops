import { deploymentRemotePaths } from "../../src/deploy/remote-paths.mjs";

test("builds isolated remote paths for one deployment", () => {
  const paths = deploymentRemotePaths("run-id");
  const home = ["", "home", "vyos"].join("/");
  expect(paths).toEqual({
    config: `${home}/.config.deploy.run-id`,
    scripts: `${home}/.scripts.run-id`,
    scriptsBackup: `${home}/.scripts-backup.run-id`,
    manifest: `${home}/.scripts.run-id/manifest.tsv`,
  });
});
