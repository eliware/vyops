import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
const { stageBackup } = await import("../../../src/backup/stage/backup.mjs");

test("stages config, scripts, and a manifest with private file modes", async () => {
  const fs = {
    mkdir: jest.fn(),
    chmod: jest.fn(),
    readFile: jest.fn().mockResolvedValue(Buffer.from("content")),
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
    files: [
      {
        name: "nested/hook.sh",
        mode: "755",
        sha256: createHash("sha256").update("content").digest("hex"),
        type: "regular file",
      },
    ],
    directories: [{ name: "nested", mode: "2755", type: "directory" }],
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
  expect(fs.writeFile).toHaveBeenCalledWith(
    "/tmp/staged/config.boot.deployment.tsv",
    `kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\ndirectory\tnested\ttrue\t2755\t-\tdirectory\t2755\t-\tdirectory\nfile\tnested/hook.sh\ttrue\t755\t${createHash("sha256").update("content").digest("hex")}\tregular file\t755\t${createHash("sha256").update("content").digest("hex")}\tregular file\n`,
    { encoding: "utf8", mode: 0o600 },
  );
});
