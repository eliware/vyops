import { jest } from "@jest/globals";
const { writeBackupManifest } = await import("../../../src/backup/write/backup-manifest.mjs");

test("writes the backup file list with private permissions", async () => {
  const fs = { writeFile: jest.fn() };
  await writeBackupManifest(fs, (...parts) => parts.join("/"), "/tmp/staged", [
    { name: "a.sh" },
    { name: "nested/b" },
  ]);
  expect(fs.writeFile).toHaveBeenCalledWith(
    "/tmp/staged/config.boot.manifest.tsv",
    "kind\tpath\nfile\ta.sh\nfile\tnested/b\n",
    { encoding: "utf8", mode: 0o600 },
  );
});
test("writes an empty backup manifest", async () => {
  const fs = { writeFile: jest.fn() };
  await writeBackupManifest(fs, (...parts) => parts.join("/"), "/tmp/staged", []);
  expect(fs.writeFile.mock.calls[0][1]).toBe("kind\tpath\n");
});
