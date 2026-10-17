const { deploymentManifestPath } = await import("../../../src/deploy/deployment/manifest-path.mjs");

test("keeps router deployment state in a separate manifest", () => {
  expect(deploymentManifestPath("config.boot")).toBe("config.boot.deployment.tsv");
});
