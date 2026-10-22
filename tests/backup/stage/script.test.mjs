import { jest } from "@jest/globals";
import { posix } from "node:path";
const { stageBackupScript } = await import("../../../src/backup/stage/script.mjs");

test("downloads a script snapshot into a private local tree", async () => {
  const fs = { mkdir: jest.fn(), chmod: jest.fn() };
  const download = jest.fn();
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const log = { debug: jest.fn() };
  await stageBackupScript({
    fs,
    path: (...parts) => posix.join(...parts),
    client: {},
    scripts: "/tmp/staged/scripts",
    name: "nested/hook.sh",
    download,
    exec,
    log,
  });
  expect(fs.mkdir).toHaveBeenCalledWith("/tmp/staged/scripts/nested", {
    recursive: true,
    mode: 0o700,
  });
  expect(download).toHaveBeenCalledWith(
    {},
    expect.stringMatching(/^\/tmp\/\.vyops-backup\.[0-9a-f-]{36}\/script$/),
    "/tmp/staged/scripts/nested/hook.sh",
  );
  expect(fs.chmod).toHaveBeenCalledWith("/tmp/staged/scripts/nested/hook.sh", 0o600);
  expect(exec).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("find -P "));
  expect(log.debug).toHaveBeenCalledWith("[vyops] backed up script: nested/hook.sh");
});

test("removes the remote snapshot when a download fails", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await expect(
    stageBackupScript({
      fs: { mkdir: jest.fn(), chmod: jest.fn() },
      path: (...parts) => posix.join(...parts),
      client: {},
      scripts: "/tmp/staged/scripts",
      name: "hook.sh",
      download: jest.fn().mockRejectedValue(new Error("download failed")),
      exec,
      log: { debug: jest.fn() },
    }),
  ).rejects.toThrow("download failed");
  expect(exec).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("find -P "));
});

test("fails the backup when remote snapshot cleanup fails", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0 })
    .mockResolvedValueOnce({ code: 1, stderr: "", stdout: "cleanup denied" });
  await expect(
    stageBackupScript({
      fs: { mkdir: jest.fn(), chmod: jest.fn() },
      path: (...parts) => posix.join(...parts),
      client: {},
      scripts: "/tmp/staged/scripts",
      name: "hook.sh",
      download: jest.fn(),
      exec,
      log: { debug: jest.fn() },
    }),
  ).rejects.toThrow("remote snapshot cleanup failed: cleanup denied");
  expect(exec).toHaveBeenCalledTimes(2);
});

test("keeps the download error when snapshot cleanup also fails", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0 })
    .mockResolvedValueOnce({ code: 1, stderr: "", stdout: "cleanup denied" });
  await expect(
    stageBackupScript({
      fs: { mkdir: jest.fn(), chmod: jest.fn() },
      path: (...parts) => posix.join(...parts),
      client: {},
      scripts: "/tmp/staged/scripts",
      name: "hook.sh",
      download: jest.fn().mockRejectedValue(new Error("download failed")),
      exec,
      log: { debug: jest.fn() },
    }),
  ).rejects.toMatchObject({
    message: "remote snapshot cleanup failed: cleanup denied",
    cause: expect.objectContaining({ message: "download failed" }),
  });
});

test("reports an SSH error when remote snapshot cleanup cannot run", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0 })
    .mockRejectedValueOnce(new Error("SSH closed"));
  await expect(
    stageBackupScript({
      fs: { mkdir: jest.fn(), chmod: jest.fn() },
      path: (...parts) => posix.join(...parts),
      client: {},
      scripts: "/tmp/staged/scripts",
      name: "hook.sh",
      download: jest.fn(),
      exec,
      log: { debug: jest.fn() },
    }),
  ).rejects.toThrow("SSH closed");
});
