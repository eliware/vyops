import { jest } from "@jest/globals";
import { join, parse, resolve } from "node:path";

const fsMocks = {
  mkdir: jest.fn(),
  chmod: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
};
const mocks = {
  connect: jest.fn(),
  parseTarget: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue(undefined),
  exec: jest.fn(),
};
jest.unstable_mockModule("@eliware/common", () => ({
  fs: { promises: fsMocks },
  path: (...parts) => join(...parts),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule("../src/ssh.mjs", () => mocks);
jest.unstable_mockModule("../src/ssh/exec.mjs", () => ({ exec: mocks.exec }));
jest.unstable_mockModule("../src/ssh/download.mjs", () => ({ download: mocks.download }));
const { backup } = await import("../src/backup.mjs");

beforeEach(() => {
  jest.clearAllMocks();
  mocks.parseTarget.mockReset().mockImplementation(() => {});
  mocks.connect.mockResolvedValue({});
  mocks.exec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" }).mockResolvedValue({
    code: 0,
    stdout: "/config/scripts/foo.sh\0/config/scripts/nested/bar\0",
    stderr: "",
  });
});

test("backs up config and nested scripts", async () => {
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).resolves.toBe(0);
  expect(mocks.download).toHaveBeenNthCalledWith(
    1,
    expect.anything(),
    "/config/config.boot",
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]config\.boot$/),
  );
  expect(mocks.download).toHaveBeenNthCalledWith(
    2,
    expect.anything(),
    expect.stringMatching(/^\/tmp\/\.vyops-backup\.[0-9a-f-]{36}\/script$/),
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]scripts[\\/]foo\.sh$/),
  );
  expect(mocks.download).toHaveBeenNthCalledWith(
    3,
    expect.anything(),
    expect.stringMatching(/^\/tmp\/\.vyops-backup\.[0-9a-f-]{36}\/script$/),
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]scripts[\\/]nested[\\/]bar$/),
  );
  expect(
    mocks.exec.mock.calls.some(
      ([, command]) => command.includes("exec 3<") && command.includes("/proc/self/fd/3"),
    ),
  ).toBe(true);
  expect(mocks.exec.mock.calls.some(([, command]) => command.includes("mkdir -m 700 -- '"))).toBe(
    true,
  );
  expect(
    mocks.exec.mock.calls.some(([, command]) => command.includes("rm -rf -- '/tmp/.vyops-backup.")),
  ).toBe(true);
  expect(fsMocks.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]config\.boot\.manifest\.tsv$/),
    "kind\tpath\nfile\tfoo.sh\nfile\tnested/bar\n",
    { encoding: "utf8", mode: 0o600 },
  );
  expect(mocks.close).toHaveBeenCalled();
  expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining(".vyops-backup-"), {
    mode: 0o700,
  });
});

test("rejects an invalid target before it connects", async () => {
  mocks.parseTarget.mockImplementation(() => {
    throw new Error("invalid target");
  });
  await expect(backup({ target: "invalid", config: "/tmp/backup" })).rejects.toThrow(
    "invalid target",
  );
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
});

test("rejects a filesystem root before it connects", async () => {
  const root = parse(resolve(".")).root;
  await expect(backup({ target: "vyos@router", config: root })).rejects.toThrow(
    "backup destination must not be a filesystem root",
  );
  expect(mocks.connect).not.toHaveBeenCalled();
});

test("passes a bootstrap password through to SSH", async () => {
  await expect(
    backup({ target: "vyos@router", config: "/tmp/backup", password: "bootstrap-secret" }),
  ).resolves.toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith("vyos@router", { password: "bootstrap-secret" });
});

test("rejects unsafe remote script paths and closes SSH", async () => {
  mocks.exec.mockReset();
  mocks.exec.mockImplementation((_client, command) =>
    Promise.resolve(
      command.includes("type l")
        ? { code: 0, stdout: "", stderr: "" }
        : { code: 0, stdout: "/config/scripts/../private\n", stderr: "" },
    ),
  );
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "unsafe remote script path",
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(fsMocks.mkdir).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalled();
});

test.each([
  ["stderr", "find failed", ""],
  ["stdout", "", "find output"],
])("reports remote script listing failures from %s", async (_label, stderr, stdout) => {
  mocks.exec.mockReset();
  mocks.exec.mockImplementation((_client, command) =>
    Promise.resolve(
      command.includes("type l")
        ? { code: 0, stdout: "", stderr: "" }
        : { code: 1, stdout, stderr },
    ),
  );
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    `could not list remote scripts: ${stderr || stdout}`,
  );
  expect(mocks.close).toHaveBeenCalled();
});

test("closes SSH when downloading the backup fails", async () => {
  mocks.download.mockRejectedValueOnce(new Error("config download failed"));
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "config download failed",
  );
  expect(mocks.close).toHaveBeenCalled();
});

test("validates scripts before it downloads the config", async () => {
  mocks.download.mockRejectedValueOnce(new Error("config download failed"));
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow();
  expect(mocks.exec).toHaveBeenCalledTimes(4);
});

test("rejects failure while inspecting remote symlinks", async () => {
  mocks.exec.mockReset();
  mocks.exec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "inspection failed" });
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "could not inspect remote scripts: inspection failed",
  );
  expect(mocks.close).toHaveBeenCalled();
});

test("reports stdout when symlink inspection has no stderr", async () => {
  mocks.exec.mockReset();
  mocks.exec.mockResolvedValueOnce({ code: 1, stdout: "inspection output", stderr: "" });
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "could not inspect remote scripts: inspection output",
  );
});

test("rejects a discovered remote script symlink", async () => {
  mocks.exec.mockReset();
  mocks.exec.mockResolvedValueOnce({ code: 0, stdout: "/config/scripts/link.sh\0", stderr: "" });
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "remote script symlink rejected: /config/scripts/link.sh",
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(fsMocks.mkdir).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalled();
});
test("rejects a script replaced before metadata validation", async () => {
  mocks.exec.mockReset();
  mocks.exec
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "/config/scripts/hook.sh\0", stderr: "" })
    .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "path changed" });
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "remote script changed or is not a regular file: /config/scripts/hook.sh",
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(fsMocks.mkdir).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalled();
});
