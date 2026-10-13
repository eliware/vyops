import { jest } from "@jest/globals";
import { posix } from "node:path";
import { stageBackupScript } from "../../src/backup/stage-script.mjs";

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
  expect(exec).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("rm -rf --"));
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
  expect(exec).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("rm -rf --"));
});
