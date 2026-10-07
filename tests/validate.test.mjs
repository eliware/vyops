import { readAndValidateConfig, validateConfig } from "../src/validate.mjs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("accepts native hierarchical config and comments", () => {
  expect(() =>
    validateConfig(
      `interfaces {\n    ethernet eth0 {\n        address 192.0.2.1/24 # comment\n    }\n}`,
    ),
  ).not.toThrow();
});

test.each([
  ["unterminated quote", 'system {\n    host-name "router\n}'],
  ["unexpected closing brace", "}"],
  ["unbalanced braces", "system {\n    host-name router"],
  ["brace with trailing content", "system { junk"],
])("rejects %s", (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test("accepts braces and hashes inside quotes", () => {
  expect(() =>
    validateConfig('system {\n    login {\n        banner post-login "hello # { world"\n    }\n}'),
  ).not.toThrow();
});

test("covers readAndValidateConfig", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-validate-"));
  const path = join(directory, "config.boot");
  await writeFile(path, "system {\n    host-name router\n}\n");
  try {
    await expect(readAndValidateConfig(path)).resolves.toBe("system {\n    host-name router\n}\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects empty, multiple, or malformed braces and comment-only input", () => {
  expect(() => validateConfig("")).toThrow(/file is empty/);
  expect(() => validateConfig("system { junk }")).toThrow(/opening and closing brace/);
  expect(() => validateConfig("system { {")).toThrow(/multiple opening braces/);
  expect(() => validateConfig("system } }")).toThrow(/multiple closing braces/);
  expect(() => validateConfig("# only a comment")).toThrow(/no configuration statements/);
  expect(() => validateConfig("system {\n    value }\n}")).toThrow(/closing brace must be alone/);
});
