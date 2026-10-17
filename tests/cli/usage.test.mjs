const { usage } = await import("../../src/cli/usage.mjs");

test("documents each supported command and global option", () => {
  expect(usage).toContain("vyops preflight [--debug] <config.boot>");
  expect(usage).toContain("vyops release --yes");
  expect(usage).toContain("vyops backup [--debug]");
  expect(usage).toContain("vyops --help");
  expect(usage).toContain("vyops --version");
});
