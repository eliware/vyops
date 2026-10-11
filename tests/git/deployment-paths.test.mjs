import { deploymentPaths } from "../../src/git/deployment-paths.mjs";

test("lists config, bundle manifest, and deployment manifest", () => {
  expect(deploymentPaths("config.boot")).toEqual([
    "config.boot",
    "config.boot.manifest.tsv",
    "config.boot.deployment.tsv",
  ]);
});
