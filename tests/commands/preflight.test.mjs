import { jest } from "@jest/globals";
const readConfigFile = jest.fn().mockResolvedValue("config");
const validateConfig = jest.fn();
const validateBundle = jest
  .fn()
  .mockResolvedValue({ target: "vyos@router", scripts: [{ name: "hook.sh" }] });
const validateScriptManifest = jest.fn().mockResolvedValue(undefined);
const readDeploymentState = jest.fn().mockResolvedValue({ managed: new Set(), hasManifest: true });
jest.unstable_mockModule("../../src/validate/config-file.mjs", () => ({ readConfigFile }));
jest.unstable_mockModule("../../src/validate/config.mjs", () => ({ validateConfig }));
jest.unstable_mockModule("../../src/bundle.mjs", () => ({
  validateBundle,
  validateScriptManifest,
}));
jest.unstable_mockModule("../../src/deploy/script/manifest.mjs", () => ({ readDeploymentState }));
const { runPreflight } = await import("../../src/commands/preflight.mjs");
test("validates and reports bundle details", async () => {
  const log = { debug: jest.fn(), info: jest.fn() };
  const args = { config: "/tmp/config.boot" };
  await runPreflight(args, log);
  expect(readConfigFile).toHaveBeenCalledWith(args.config);
  expect(validateConfig).toHaveBeenCalledWith("config");
  expect(validateBundle).toHaveBeenCalledWith(args.config, "config");
  expect(validateScriptManifest).toHaveBeenCalledWith(args.config, undefined, ["hook.sh"]);
  expect(readDeploymentState).toHaveBeenCalledWith(
    expect.any(Function),
    `${args.config}.deployment.tsv`,
  );
  expect(log.info).toHaveBeenCalledWith("Preflight complete: vyos@router (1 script files)");
});

test("stops preflight when the local deployment manifest is invalid", async () => {
  readDeploymentState.mockRejectedValueOnce(
    new Error("deployment manifest contains a duplicate script path"),
  );
  await expect(
    runPreflight({ config: "/tmp/config.boot" }, { debug: jest.fn(), info: jest.fn() }),
  ).rejects.toThrow("preflight failed: deployment manifest contains a duplicate script path");
});
