import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { completeDeployment } = await import("../../src/deploy/complete.mjs");
const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";

test("completes deployment phases in order and finalizes hooks", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-complete-"));
  const config = join(root, "config.boot");
  const previousClient = {};
  const nextClient = {};
  let client = previousClient;
  const phases = [];
  const connectClient = jest.fn().mockResolvedValue(nextClient);
  const close = jest.fn();
  const finalizeHooks = jest.fn();
  const setHooksFinalized = jest.fn();
  try {
    await completeDeployment({
      getClient: () => client,
      setClient: (value) => {
        client = value;
      },
      connectClient,
      close,
      download: jest.fn(),
      manifest: "manifest",
      config,
      finalizeHooks,
      verify: false,
      exec: async () => {},
      log: { info: jest.fn() },
      redact: (value) => value,
      phase: (value) => phases.push(value),
      debugLog: jest.fn(),
      setHooksFinalized,
    });
    expect(close).toHaveBeenCalledWith(previousClient);
    expect(connectClient).toHaveBeenCalledTimes(1);
    expect(client).toBe(nextClient);
    expect(phases).toEqual([
      "download synchronized config",
      "download deployment manifest",
      "run post-commit scripts",
    ]);
    expect(finalizeHooks).toHaveBeenCalledWith(true, nextClient);
    expect(setHooksFinalized).toHaveBeenCalledTimes(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("does not mark hooks finalized when cleanup fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-complete-"));
  const config = join(root, "config.boot");
  const setHooksFinalized = jest.fn();
  try {
    await expect(
      completeDeployment({
        getClient: () => ({}),
        setClient: () => {},
        connectClient: async () => ({}),
        close: async () => {},
        download: async (_client, _remote, local) => writeFile(local, "new config"),
        manifest: "manifest",
        config,
        finalizeHooks: jest.fn().mockResolvedValue(false),
        verify: false,
        exec: async () => {},
        log: { info: jest.fn() },
        redact: (value) => value,
        phase: () => {},
        debugLog: () => {},
        setHooksFinalized,
      }),
    ).rejects.toThrow("post-commit script finalization failed");
    expect(setHooksFinalized).not.toHaveBeenCalled();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
