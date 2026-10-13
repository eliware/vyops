import { configBlock } from "../../src/bundle/config-block.mjs";

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

test("returns empty text when the block is absent or incomplete", () => {
  expect(configBlock("interfaces {}", "system")).toBe("");
  expect(configBlock("system {\n login {\n", "system")).toBe("");
});
