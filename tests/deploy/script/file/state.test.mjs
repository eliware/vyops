const { scriptFileState } = await import("../../../../src/deploy/script/file/state.mjs");

test("records and backs up an existing regular script", () => {
  const command = scriptFileState({
    name: "nested/hook.sh",
    parent: "nested",
    backupDir: "/tmp/backup",
    backup: "/tmp/backup/nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
  });
  expect(command).toContain("destination is a symlink");
  expect(command).toContain("sudo cp -p --");
  expect(command).toContain("sha256sum");
  expect(command).toContain("file\\t%s\\tfalse");
});
