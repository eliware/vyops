import { fileURLToPath } from "node:url";
import { join } from "node:path";

export async function setupDeployHarness(jest) {
  const fsMocks = { readdir: jest.fn(), stat: jest.fn() };
  const logMock = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const mocks = {
    connect: jest.fn(),
    download: jest.fn(),
    exec: jest.fn(),
    interactive: jest.fn(),
    upload: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  jest.unstable_mockModule("@eliware/common", () => ({
    fs: { promises: fsMocks },
    path: (...segments) => join(...segments),
    log: logMock,
  }));
  const source = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
  jest.unstable_mockModule(source("src/ssh.mjs"), () => mocks);
  jest.unstable_mockModule(source("src/ssh/exec.mjs"), () => ({ exec: mocks.exec }));
  jest.unstable_mockModule(source("src/ssh/interactive.mjs"), () => ({
    interactive: mocks.interactive,
  }));
  jest.unstable_mockModule(source("src/ssh/download.mjs"), () => ({ download: mocks.download }));
  jest.unstable_mockModule(source("src/ssh/upload.mjs"), () => ({ upload: mocks.upload }));
  const { cleanupActiveDeployments, deploy } = await import(source("src/deploy.mjs"));
  const client = () => ({ end: jest.fn() });
  const reset = () => {
    jest.clearAllMocks();
    delete process.env.VYOPS_DEBUG;
    fsMocks.readdir.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    fsMocks.stat.mockResolvedValue({ mode: 0o100755 });
    mocks.connect.mockResolvedValue(client());
    mocks.download.mockResolvedValue(undefined);
    mocks.exec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    mocks.interactive.mockImplementation(async (_client, commands, _log, onComplete) => {
      commands.forEach((item) => onComplete?.(typeof item === "string" ? item : item.command));
      return "";
    });
  };
  globalThis.beforeEach(reset);
  return { fsMocks, logMock, mocks, client, deploy, cleanupActiveDeployments, reset };
}
