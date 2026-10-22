import { installedScriptManifestCommand } from "../../../../src/deploy/script/manifest/command.mjs";

test("builds a command that replaces the selected manifest entry", () => {
  const command = installedScriptManifestCommand({
    name: "nested/hook.sh",
    installed: "/config/scripts/nested/hook.sh",
    manifest: "/tmp/manifest.tsv",
  });
  expect(command).toContain("sha256sum");
  expect(command).toContain('path="nested/hook.sh"');
  expect(command).toContain("awk -F");
  expect(command).toContain('mv -- "$manifest_tmp" "/tmp/manifest.tsv"');
  expect(command).not.toContain('>> "/tmp/manifest.tsv"');
});
