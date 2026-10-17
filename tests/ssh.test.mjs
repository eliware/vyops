import { promises, resetMemoryFilesystem } from "../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, writeFile, mkdir, rm } = await import("node:fs/promises");
import { join } from "node:path";
const {
  MockClient,
  fs: fixtureFs,
  mockHostVerifier,
  createSshClientModule,
} = await import("../test-fixtures/ssh-client.mjs");

jest.unstable_mockModule("@eliware/ssh-client", () =>
  createSshClientModule({ MockClient, fs: fixtureFs, join, mockHostVerifier }),
);
const { connect, close, closeAll } = await import("../src/ssh.mjs");

beforeEach(() => {
  MockClient.instances.length = 0;
  delete process.env.VYOPS_SSH_KEY;
  delete process.env.SSH_AUTH_SOCK;
  process.env.HOME = ["", "home", "test"].join("/");
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_CONNECT_TIMEOUT;
});

async function prepareKey() {
  const dir = await mkdtemp(join("/virtual", "ssh-test-"));
  const key = join(dir, "key");
  await writeFile(key, "key");
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  process.env.HOME = dir;
  process.env.VYOPS_SSH_KEY = key;
  return dir;
}

test("closes reusable SSH connections", async () => {
  const dir = await prepareKey();
  const client = await connect("vyos@router");
  await closeAll();
  expect(client.state).toBe("closed");
  await rm(dir, { recursive: true, force: true });
});

test("ignores a missing client and reports close errors", async () => {
  await expect(close(null)).resolves.toBeUndefined();
  const client = { close: jest.fn().mockRejectedValue(new Error("close failed")) };
  await expect(close(client)).rejects.toThrow("close failed");
  expect(client.close).toHaveBeenCalledTimes(1);
});
