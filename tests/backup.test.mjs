import { jest } from "@jest/globals";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const fsMocks = {
  mkdir: jest.fn(),
  chmod: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn().mockResolvedValue(Buffer.from("content")),
};
const mocks = {
  connect: jest.fn(),
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
  mocks.connect.mockResolvedValue({});
  mocks.exec
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({
      code: 0,
      stdout: "/config/scripts/foo.sh\0/config/scripts/nested/bar\0",
      stderr: "",
    })
    .mockResolvedValueOnce({
      code: 0,
      stdout: `755\t${createHash("sha256").update("content").digest("hex")}\tregular file\n`,
      stderr: "",
    })
    .mockResolvedValueOnce({
      code: 0,
      stdout: `755\t${createHash("sha256").update("content").digest("hex")}\tregular file\n`,
      stderr: "",
    })
    .mockResolvedValue({ code: 0, stdout: "755\n", stderr: "" });
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
    mocks.exec.mock.calls.some(([, command]) => command.includes("find -P '/tmp/.vyops-backup.")),
  ).toBe(true);
  expect(fsMocks.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]config\.boot\.manifest\.tsv$/),
    "kind\tpath\nfile\tfoo.sh\nfile\tnested/bar\n",
    { encoding: "utf8", mode: 0o600 },
  );
  const contentHash = createHash("sha256").update("content").digest("hex");
  expect(fsMocks.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/\.vyops-backup-[0-9a-f-]{36}[\\/]config\.boot\.deployment\.tsv$/),
    `kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\tfoo.sh\ttrue\t755\t${contentHash}\tregular file\t755\t${contentHash}\tregular file\ndirectory\tnested\ttrue\t755\t-\tdirectory\t755\t-\tdirectory\nfile\tnested/bar\ttrue\t755\t${contentHash}\tregular file\t755\t${contentHash}\tregular file\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  expect(mocks.close).toHaveBeenCalled();
  expect(fsMocks.mkdir).toHaveBeenCalledWith(expect.stringContaining(".vyops-backup-"), {
    mode: 0o700,
  });
});

test("passes a bootstrap password through to SSH", async () => {
  await expect(
    backup({ target: "vyos@router", config: "/tmp/backup", password: "bootstrap-secret" }),
  ).resolves.toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith("vyos@router", { password: "bootstrap-secret" });
});

test("uses the resolved path for a relative backup destination", async () => {
  const destination = resolve("relative/../backup-output");
  await expect(
    backup({ target: "vyos@router", config: "relative/../backup-output" }),
  ).resolves.toBe(0);
  expect(fsMocks.rename).toHaveBeenCalledWith(
    `${destination}/config.boot`,
    expect.stringContaining(".vyops-backup-old-"),
  );
});

test("closes SSH when downloading the backup fails", async () => {
  mocks.download.mockRejectedValueOnce(new Error("config download failed"));
  await expect(backup({ target: "vyos@router", config: "/tmp/backup" })).rejects.toThrow(
    "config download failed",
  );
  expect(mocks.close).toHaveBeenCalled();
  expect(mocks.exec).toHaveBeenCalledTimes(5);
});
