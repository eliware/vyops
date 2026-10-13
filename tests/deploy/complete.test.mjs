import { jest } from "@jest/globals";
import { completeDeployment } from "../../src/deploy/complete.mjs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPreflight } from "../../src/commands/preflight.mjs";

test("downloads the confirmed config and finalizes hooks", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-complete-"));
  const config = join(root, "config.boot");
  const configText =
    "system {\n    host-name test-router\n    login {\n        user vyos {\n        }\n    }\n}\n";
  await writeFile(config, configText);
  await mkdir(join(root, "scripts"));
  await writeFile(join(root, "scripts", "bundle.sh"), "#!/bin/sh\n");
  await writeFile(`${config}.manifest.tsv`, "kind\tpath\nfile\tbundle.sh\n");
  let client = {};
  const download = jest.fn(async (_client, remote, local) =>
    writeFile(
      local,
      remote === "/config/config.boot"
        ? configText
        : "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\tbundle.sh\tfalse\t-\t-\t-\t755\t-\tfile\n",
    ),
  );
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
  await expect(readFile(config, "utf8")).resolves.toBe(configText);
  await expect(readFile(`${config}.manifest.tsv`, "utf8")).resolves.toBe(
    "kind\tpath\nfile\tbundle.sh\n",
  );
  await expect(readFile(`${config}.deployment.tsv`, "utf8")).resolves.toContain(
    "new_mode\tnew_sha256\tnew_type",
  );
  expect(finalizeHooks).toHaveBeenCalledWith(true, client);
  await expect(
    runPreflight({ config }, { debug: jest.fn(), info: jest.fn() }),
  ).resolves.toMatchObject({
    target: "vyos@test-router",
    scripts: [{ name: "bundle.sh" }],
  });
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

test("preserves both local files when the manifest download fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-complete-"));
  const config = join(root, "config.boot");
  const deployment = `${config}.deployment.tsv`;
  await writeFile(config, "old config");
  await writeFile(deployment, "old deployment state");
  const download = jest.fn(async (_client, remote, local) => {
    if (remote === "/config/config.boot") await writeFile(local, "new config");
    else throw new Error("manifest download failed");
  });
  await expect(
    completeDeployment({
      getClient: () => ({}),
      setClient: () => {},
      connectClient: async () => ({}),
      close: async () => {},
      download,
      manifest: "manifest",
      config,
      finalizeHooks: jest.fn(),
      verify: false,
      exec: async () => {},
      log: { info: jest.fn() },
      redact: (value) => value,
      phase: () => {},
      debugLog: () => {},
      setHooksFinalized: jest.fn(),
    }),
  ).rejects.toThrow("manifest download failed");
  await expect(readFile(config, "utf8")).resolves.toBe("old config");
  await expect(readFile(deployment, "utf8")).resolves.toBe("old deployment state");
  await rm(root, { recursive: true, force: true });
});

test("does not mark hooks finalized when cleanup fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-complete-"));
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
    ).rejects.toThrow("hook finalization failed");
    expect(setHooksFinalized).not.toHaveBeenCalled();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
