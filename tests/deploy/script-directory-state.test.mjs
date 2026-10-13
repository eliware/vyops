import { scriptDirectoryState } from "../../src/deploy/script-directory-state.mjs";

test("records each missing parent directory from shallow to deep", () => {
  const command = scriptDirectoryState({
    parent: "nested/deeper",
    installDir: "/config/scripts",
    manifest: "/tmp/manifest.tsv",
  });
  expect(command).toContain('p="nested"');
  expect(command).toContain('p="nested/deeper"');
  expect(command.indexOf('p="nested"')).toBeLessThan(command.indexOf('p="nested/deeper"'));
  expect(command).toContain("dirPreexisting=true");
  expect(command).toContain("directory\\t%s");
});

test("emits no directory commands for a root script", () => {
  expect(
    scriptDirectoryState({
      parent: ".",
      installDir: "/config/scripts",
      manifest: "/tmp/manifest.tsv",
    }),
  ).toBe("");
});
