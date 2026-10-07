import { EventEmitter } from "node:events";
import fs from "node:fs";

export { fs };

export function mockHostVerifier(knownHosts, key, callback) {
  const blocked = knownHosts
    .split(/\r?\n/)
    .some((line) => line.startsWith("@revoked router") || line.startsWith("!router "));
  const accepted = !blocked && Buffer.isBuffer(key) && key.length === 0;
  callback?.(accepted);
  return accepted;
}

export class MockStream extends EventEmitter {
  constructor() {
    super();
    this.stderr = new EventEmitter();
    this.writes = [];
    this.closed = false;
    this.ended = false;
  }
  write(value) {
    this.writes.push(value);
  }
  end() {
    this.ended = true;
  }
  close() {
    this.closed = true;
    this.emit("close");
  }
}

export class MockClient extends EventEmitter {
  static instances = [];
  constructor() {
    super();
    this.shellStream = new MockStream();
    this.sftpClient = {
      writeFile: (_remote, _data, _options, callback) => callback(null),
      fastGet: (_remote, _local, callback) => callback(null),
    };
    MockClient.instances.push(this);
  }
  connect(options) {
    this.options = options;
    const error = MockClient.nextConnectError;
    MockClient.nextConnectError = null;
    queueMicrotask(() => this.emit(error ? "error" : "ready", error));
  }
  end() {
    this.emit("close");
  }
  exec(command, callback) {
    this.execCallback?.(command, callback);
  }
  sftp(callback) {
    callback(null, this.sftpClient);
  }
  shell(options, callback) {
    this.shellOptions = options;
    callback(null, this.shellStream);
  }
}

export function createSshClientModule({ MockClient, fs, join, mockHostVerifier }) {
  return {
    connect: async (options) => {
      const client = new MockClient();
      const privateKeyPath = options.privateKeyPath || join(process.env.HOME, ".ssh/id_rsa");
      const privateKey =
        options.password === undefined ? await fs.promises.readFile(privateKeyPath) : undefined;
      const knownHosts = options.knownHostsPath
        ? await fs.promises.readFile(join(process.env.HOME, ".ssh/known_hosts"), "utf8")
        : "";
      let actual;
      const _utils = {
        parseKey: (key) => {
          if (Buffer.isBuffer(key)) {
            if (key.length === 0) {
              actual = { getPublicSSH: () => ({}) };
              return actual;
            }
            return {};
          }
          return { getPublicSSH: () => ({ equals: (value) => value === actual }) };
        },
      };
      const connectionOptions = {
        ...options,
        privateKey,
        hostVerifier: options.knownHostsPath
          ? (key, callback) => mockHostVerifier(knownHosts, key, callback)
          : undefined,
      };
      await new Promise((resolve, reject) => {
        client.once("ready", resolve);
        client.once("error", reject);
        client.connect(connectionOptions);
      });
      return { raw: client };
    },
  };
}
