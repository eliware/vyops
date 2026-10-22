const { configBlock } = await import("../../src/bundle/config-block.mjs");

test("extracts nested blocks and ignores braces in comments and quoted text", () => {
  const config = `system {
  note "quoted } brace"
  # ignored }
  login {
    user vyos {
    }
  }
}`;
  expect(configBlock(config, "system")).toContain('note "quoted } brace"');
  expect(configBlock(config, "system")).toContain("user vyos");
});

test("closes a quoted value after an escaped backslash", () => {
  const config = 'system {\n host-name "router\\\\"\n login {\n  user vyos {\n  }\n }\n}\n';
  expect(configBlock(config, "system")).toContain("user vyos");
});

test("returns empty text when the block is absent or incomplete", () => {
  expect(configBlock("interfaces {}", "system")).toBe("");
  expect(configBlock("system {\n login {\n", "system")).toBe("");
});

test("ignores declaration braces inside quoted text", () => {
  expect(configBlock('system "quoted { text"', 'system "quoted')).toBe("");
});
