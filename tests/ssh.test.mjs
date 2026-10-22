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

test("host verifier accepts a known host and rejects a mismatch", async () => {
  const dir = await prepareKey();
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "# comment\n\nrouter ssh-ed25519 AAAA\nmalformed\n",
  );
  const client = await connect("vyos@router");
  const verify = (key) => new Promise((resolve) => client.options.hostVerifier(key, resolve));
  await expect(verify(Buffer.alloc(0))).resolves.toBe(true);
  await expect(verify(Buffer.from("mismatch"))).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test("host verifier rejects revoked, negated, wildcard, and malformed entries", async () => {
  const dir = await prepareKey();
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "@cert-authority router ssh-ed25519 AAAA\n@revoked router ssh-ed25519 AAAA\n*.example ssh-ed25519 AAAA\n|1|bad|bad ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n",
  );
  const client = await connect("vyos@router");
  await expect(
    new Promise((resolve) => client.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test("host verifier accepts valid hashed hosts and rejects malformed hashes", async () => {
  const dir = await prepareKey();
  const { createHmac } = await import("node:crypto");
  const salt = Buffer.from("salt");
  const digest = createHmac("sha1", salt).update("router").digest("base64");
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    `|1|${salt.toString("base64")}|${digest} ssh-ed25519 AAAA\nrouter badtype bad\n`,
  );
  const client = await connect("vyos@router");
  await expect(
    new Promise((resolve) => client.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(true);
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "|2|salt|digest ssh-ed25519 AAAA\n|1||| ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n",
  );
  const rejectedClient = await connect("vyos@router");
  await expect(
    new Promise((resolve) => rejectedClient.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});
