import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { jest } from "@jest/globals";
import {
  MockClient,
  fs as fixtureFs,
  mockHostVerifier,
  createSshClientModule,
} from "../test-fixtures/ssh-client.mjs";

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
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
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

test("ignores a missing client and handles close errors", async () => {
  await expect(close(null)).resolves.toBeUndefined();
  const client = { close: jest.fn().mockRejectedValue(new Error("close failed")) };
  await expect(close(client)).resolves.toBeUndefined();
  expect(client.close).toHaveBeenCalledTimes(1);
});
