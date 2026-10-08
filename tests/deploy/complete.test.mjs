import { jest } from "@jest/globals";
import { completeDeployment } from "../../src/deploy/complete.mjs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("downloads the confirmed config and finalizes hooks", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-complete-"));
  const config = join(root, "config.boot");
  await writeFile(config, "old config");
  let client = {};
  const download = jest.fn();
  const finalizeHooks = jest.fn();
  await completeDeployment({
    getClient: () => client,
    setClient: (value) => {
      client = value;
    },
    connectClient: async () => ({ next: true }),
    close: async () => {},
    download,
    manifest: "manifest",
    config,
    finalizeHooks,
    verify: false,
    exec: async () => {},
    log: { info: jest.fn() },
    redact: (value) => value,
    phase: () => {},
    debugLog: () => {},
    setHooksFinalized: jest.fn(),
  });
  expect(download).toHaveBeenCalledTimes(2);
  await expect(readFile(config, "utf8")).resolves.toBe("");
  await expect(readFile(`${config}.manifest.tsv`, "utf8")).resolves.toBe("");
  expect(finalizeHooks).toHaveBeenCalledWith(true, client);
  await rm(root, { recursive: true, force: true });
});

test("preserves the local config when the download fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-complete-"));
  const config = join(root, "config.boot");
  await writeFile(config, "old config");
  await expect(
    completeDeployment({
      getClient: () => ({}),
      setClient: () => {},
      connectClient: async () => ({}),
      close: async () => {},
      download: jest.fn().mockRejectedValue(new Error("download failed")),
      manifest: "manifest",
      config,
      finalizeHooks: null,
      verify: false,
      exec: async () => {},
      log: { info: jest.fn() },
      redact: (value) => value,
      phase: () => {},
      debugLog: () => {},
      setHooksFinalized: jest.fn(),
    }),
  ).rejects.toThrow("download failed");
  await expect(readFile(config, "utf8")).resolves.toBe("old config");
  await rm(root, { recursive: true, force: true });
});
