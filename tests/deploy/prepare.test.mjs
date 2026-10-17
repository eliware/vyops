import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
import { join } from "node:path";
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
const { setupDeployHarness } = await import("../../test-fixtures/deploy-harness.mjs");
const { prepareDeployment } = await import("../../src/deploy/prepare.mjs");

test("preflights and uploads before script installation", async () => {
  const events = [];
  const options = {
    client: {},
    config: "config.boot",
    remote: "/tmp/config",
    runId: "run",
    verifyBinaries: false,
    hasHaproxyHooks: false,
    hasBinaryScripts: false,
    noHooks: false,
    redact: (value) => value,
    phase: (name) => events.push(name),
    debugLog: () => {},
    exec: async () => {},
    remotePreflight: async () => events.push("preflight"),
    upload: async () => events.push("upload"),
    installScripts: async () => {
      events.push("scripts");
      return "finalize";
    },
  };
  await expect(prepareDeployment(options)).resolves.toBe("finalize");
  expect(events).toEqual([
    "remote preflight",
    "preflight",
    "upload config",
    "upload",
    "upload scripts",
    "scripts",
  ]);
});

test("skips script installation when hooks are disabled", async () => {
  const installScripts = jest.fn();
  await prepareDeployment({
    client: {},
    config: "config",
    remote: "remote",
    runId: "id",
    verifyBinaries: false,
    hasHaproxyHooks: false,
    hasBinaryScripts: false,
    noHooks: true,
    redact: (value) => value,
    phase: () => {},
    debugLog: () => {},
    exec: async () => {},
    remotePreflight: async () => {},
    upload: async () => {},
    installScripts,
  });
  expect(installScripts).not.toHaveBeenCalled();
});

const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);

test("skips hooks when requested", async () => {
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      noHooks: true,
    }),
  ).resolves.toBe(0);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
});

test("aborts before interactive deployment when remote script validation fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-deploy-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "hook.sh"), "#!/bin/sh\n");
  fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
  mocks.exec.mockImplementation(async (_client, command) =>
    command.includes("printf '\\r'")
      ? { code: 1, stdout: "", stderr: "CRLF detected" }
      : { code: 0, stdout: "", stderr: "" },
  );
  try {
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).rejects.toThrow("remote script preflight failed (hook.sh): CRLF detected");
    expect(mocks.interactive).not.toHaveBeenCalled();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
