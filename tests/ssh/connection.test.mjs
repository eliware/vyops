import {
  MockClient,
  MockStream,
  fs,
  mockHostVerifier,
  createSshClientModule,
} from "../../test-fixtures/ssh-client.mjs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { jest as testJest } from "@jest/globals";
testJest.unstable_mockModule("@eliware/ssh-client", () =>
  createSshClientModule({ MockClient, fs, join, mockHostVerifier }),
);
const { connect } = await import("../../src/ssh.mjs");
const { connect: establishConnection } = await import("../../src/ssh/connection.mjs");
const { exec } = await import("../../src/ssh/exec.mjs");

beforeEach(() => {
  MockClient.instances.length = 0;
  delete process.env.VYOPS_SSH_KEY;
  delete process.env.SSH_AUTH_SOCK;
  delete process.env.VYOPS_CONNECT_TIMEOUT;
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

afterEach(() => {
  delete process.env.VYOPS_CONNECT_TIMEOUT;
});

test("connection module exports its connection operation", () => {
  expect(establishConnection).toBeInstanceOf(Function);
});
test("connect parses user@host and resolves on ready", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  const key = join(keyDir, "key");
  await writeFile(key, "private-key");
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  process.env.SSH_AUTH_SOCK = "/tmp/agent.sock";
  const promise = connect("vyos@router");
  const client = await promise;
  expect(client.options).toMatchObject({
    host: "router",
    username: "vyos",
    agent: "/tmp/agent.sock",
    privateKey: Buffer.from("private-key"),
  });
  expect(client.options.hostVerifier).toEqual(expect.any(Function));
  await rm(keyDir, { recursive: true, force: true });
});

test("connect uses the default key path", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  process.env.HOME = keyDir;
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/id_rsa"), "default-key");
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  const client = await connect("vyos@router");
  expect(client.options.privateKey).toEqual(Buffer.from("default-key"));
  await rm(keyDir, { recursive: true, force: true });
});

test("connect supports password authentication without reading a private key", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  process.env.HOME = keyDir;
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  const client = await connect("vyos@router", { password: "bootstrap-secret" });
  expect(client.options).toMatchObject({ username: "vyos", password: "bootstrap-secret" });
  expect(client.options.privateKey).toBeUndefined();
  await rm(keyDir, { recursive: true, force: true });
});

test("connect rejects host-only targets and connection errors", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  const key = join(keyDir, "key");
  await writeFile(key, "key");
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  const error = new Error("connection failed");
  MockClient.nextConnectError = error;
  await expect(connect("router")).rejects.toThrow("invalid target");
  const promise = connect("vyos@router");
  await expect(promise).rejects.toThrow("connection failed");
  expect(MockClient.instances[0].options.username).toBe("vyos");
  await rm(keyDir, { recursive: true, force: true });
});

test("uses the operation timeout fallback for non-positive configuration", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "0";
  const client = new MockClient();
  client.execCallback = (_command, callback) => {
    const stream = new MockStream();
    callback(null, stream);
    stream.emit("close", 0);
  };
  await expect(exec(client, "show version")).resolves.toMatchObject({ code: 0 });
});

test("uses timeout defaults for invalid and non-positive environment values", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  process.env.HOME = keyDir;
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/id_rsa"), "default-key");
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  process.env.VYOPS_CONNECT_TIMEOUT = "invalid";
  const invalid = await connect("vyos@router");
  expect(invalid.options.connectTimeout).toBe(30000);
  process.env.VYOPS_CONNECT_TIMEOUT = "0";
  const zero = await connect("vyos@router");
  expect(zero.options.connectTimeout).toBe(30000);
  process.env.VYOPS_CONNECT_TIMEOUT = "1234";
  const configured = await connect("vyos@router");
  expect(configured.options.connectTimeout).toBe(1234);
  delete process.env.VYOPS_CONNECT_TIMEOUT;
  await rm(keyDir, { recursive: true, force: true });
});

test("connect rejects missing known_hosts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/id_rsa"), "key");
  process.env.HOME = dir;
  await expect(connect("vyos@router")).rejects.toThrow();
  await rm(dir, { recursive: true, force: true });
});

test("host verifier accepts matching known host and rejects mismatch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/id_rsa"), "key");
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "# comment\n\nrouter ssh-ed25519 AAAA\nmalformed\n",
  );
  process.env.HOME = dir;
  const client = await connect("vyos@router");
  const verify = (key) => new Promise((resolve) => client.options.hostVerifier(key, resolve));
  await expect(verify(Buffer.alloc(0))).resolves.toBe(true);
  await expect(verify(Buffer.from("mismatch"))).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test("host verifier handles revoked, negated, wildcard, and hashed entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/id_rsa"), "key");
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "@cert-authority router ssh-ed25519 AAAA\n@revoked router ssh-ed25519 AAAA\n*.example ssh-ed25519 AAAA\n|1|bad|bad ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n",
  );
  process.env.HOME = dir;
  const client = await connect("vyos@router");
  await expect(
    new Promise((resolve) => client.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test("host verifier handles valid hashed and malformed key entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/id_rsa"), "key");
  const digest = await import("node:crypto").then(({ createHmac }) =>
    createHmac("sha1", Buffer.from("salt")).update("router").digest("base64"),
  );
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    `|1|${Buffer.from("salt").toString("base64")}|${digest} ssh-ed25519 AAAA\nrouter badtype bad\n`,
  );
  process.env.HOME = dir;
  const client = await connect("vyos@router");
  await expect(
    new Promise((resolve) => client.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(true);
  await rm(dir, { recursive: true, force: true });
});

test("host verifier rejects malformed hashes and matching negated hosts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  await mkdir(join(dir, ".ssh"), { recursive: true });
  await writeFile(join(dir, ".ssh/id_rsa"), "key");
  await writeFile(
    join(dir, ".ssh/known_hosts"),
    "|2|salt|digest ssh-ed25519 AAAA\n|1||| ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n",
  );
  process.env.HOME = dir;
  const client = await connect("vyos@router");
  await expect(
    new Promise((resolve) => client.options.hostVerifier(Buffer.alloc(0), resolve)),
  ).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});
