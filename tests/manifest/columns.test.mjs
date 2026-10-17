const { bundleManifestHeader, bundleManifestHeaderWithPreexisting, deploymentManifestHeader } =
  await import("../../src/manifest/columns.mjs");

test("defines the local bundle manifest headers", () => {
  expect(bundleManifestHeader).toBe("kind\tpath");
  expect(bundleManifestHeaderWithPreexisting).toBe("kind\tpath\tpreexisting");
});

test("defines the router deployment manifest columns in order", () => {
  expect(deploymentManifestHeader).toBe(
    "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type",
  );
});
