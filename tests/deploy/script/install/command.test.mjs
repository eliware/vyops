const { buildScriptInstallCommand } =
  await import("../../../../src/deploy/script/install/command.mjs");

const settings = { backupDir: "/tmp/backup", installDir: "/config/scripts", runId: "operation" };

test("builds a managed text install command with safety checks", () => {
  const command = buildScriptInstallCommand(
    {
      name: "nested/hook.sh",
      remote: "/tmp/stage/hook.sh",
      installed: "/config/scripts/nested/hook.sh",
      parent: "nested",
      mode: 0o755,
      executable: true,
      binary: false,
      managed: true,
    },
    settings,
  );
  expect(command).toContain("sudo install -m 755");
  expect(command).toContain("chown --reference=");
  expect(command).toContain("printf '\\r'");
  expect(command).toContain("sudo test -x");
  expect(command).toContain("sudo mv -f");
  expect(command.indexOf("sudo test -f")).toBeLessThan(command.indexOf("sudo mv -f"));
  expect(command.indexOf("sudo test ! -L")).toBeLessThan(command.indexOf("sudo mv -f"));
  expect(command.indexOf("sudo grep -q")).toBeLessThan(command.indexOf("sudo mv -f"));
});

test("builds an unmanaged binary install command without text checks", () => {
  const command = buildScriptInstallCommand(
    {
      name: "binary.exe",
      remote: "/tmp/stage/binary.exe",
      installed: "/config/scripts/binary.exe",
      parent: ".",
      mode: 0o644,
      executable: false,
      binary: true,
      managed: false,
    },
    settings,
  );
  expect(command).toContain("sudo chown root:root");
  expect(command).not.toContain("grep -q");
});
