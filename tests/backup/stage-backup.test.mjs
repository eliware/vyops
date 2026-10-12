import { jest } from "@jest/globals";
import { stageBackup } from "../../src/backup/stage-backup.mjs";

test("stages config, scripts, and a manifest with private file modes", async () => {
  const fs = {
    mkdir: jest.fn(),
    chmod: jest.fn(),
    writeFile: jest.fn(),
  };
  const path = (...parts) => parts.join("/");
  const download = jest.fn();
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const log = { debug: jest.fn() };
  await stageBackup({
    fs,
    path,
    client: {},
    staged: "/tmp/staged",
    files: ["nested/hook.sh"],
    download,
    exec,
    log,
  });
  expect(download).toHaveBeenNthCalledWith(1, {}, "/config/config.boot", "/tmp/staged/config.boot");
  expect(download).toHaveBeenNthCalledWith(
    2,
    {},
    expect.stringMatching(/^\/tmp\/\.vyops-backup\.[0-9a-f-]{36}\/script$/),
    "/tmp/staged/scripts/nested/hook.sh",
  );
  expect(fs.chmod).toHaveBeenCalledWith("/tmp/staged/config.boot", 0o600);
  expect(fs.chmod).toHaveBeenCalledWith("/tmp/staged/scripts/nested/hook.sh", 0o600);
  expect(fs.writeFile).toHaveBeenCalledWith(
    "/tmp/staged/config.boot.manifest.tsv",
    "kind\tpath\nfile\tnested/hook.sh\n",
    { encoding: "utf8", mode: 0o600 },
  );
});

test("removes each remote snapshot when its download fails", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const download = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("download failed"));
  await expect(
    stageBackup({
      fs: { mkdir: jest.fn(), chmod: jest.fn(), writeFile: jest.fn() },
      path: (...parts) => parts.join("/"),
      client: {},
      staged: "/tmp/staged",
      files: ["hook.sh"],
      download,
      exec,
      log: { debug: jest.fn() },
    }),
  ).rejects.toThrow("download failed");
  expect(exec).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("rm -rf --"));
});
