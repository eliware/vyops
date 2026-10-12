import { jest } from "@jest/globals";
import { runDeployment } from "../../src/deploy/run.mjs";

test("prepares, recovers, and cleans up when release commands fail", async () => {
  const events = [];
  const client = { state: "open" };
  const options = {
    remotePaths: { config: "/tmp/config", scripts: "/tmp/scripts", scriptsBackup: "/tmp/backup" },
    client,
    target: "vyos@test-router",
    config: "config.boot",
    runId: "run",
    verifyBinaries: false,
    hasHaproxyHooks: false,
    hasBinaryScripts: false,
    noHooks: false,
    redact: (value) => value,
    phase: (name) => events.push(name),
    debugLog: () => {},
    log: { info: jest.fn(), warn: jest.fn() },
    exec: async () => ({ code: 0, stdout: "", stderr: "" }),
    upload: async () => events.push("upload"),
    remotePreflight: async () => events.push("preflight"),
    installScripts: async () => null,
    close: async () => events.push("close"),
    connectClient: async () => {
      events.push("connect");
      return client;
    },
    setClient: () => {},
    interactive: async () => {
      events.push("interactive");
      throw new Error("release command failed");
    },
    unregisterCleanup: () => events.push("unregister"),
  };
  await expect(runDeployment(options)).rejects.toThrow("release command failed");
  expect(events).toEqual([
    "remote preflight",
    "preflight",
    "upload config",
    "upload",
    "upload scripts",
    "connect",
    "close",
    "connect",
    "interactive",
    "close",
    "connect",
    "unregister",
    "close",
  ]);
});
