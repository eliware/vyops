const { validateConfig } = await import("../../src/validate/config.mjs");

test("accepts native hierarchical config and comments", () => {
  expect(() =>
    validateConfig(
      `interfaces {\n    ethernet eth0 {\n        address 192.0.2.1/24 # comment\n    }\n}`,
    ),
  ).not.toThrow();
});

test.each([
  ["unterminated quote", 'system {\n    host-name "router\n}'],
  ["unexpected closing curly bracket", "}"],
  ["unbalanced curly brackets", "system {\n    host-name router"],
  ["brace with trailing content", "system { junk"],
  ["misindented closing brace", "system {\n    host-name router\n  }"],
  ["extra closing brace", "system {\n}\n}"],
])("rejects %s", (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test("accepts braces and hashes inside quotes", () => {
  expect(() =>
    validateConfig('system {\n    login {\n        banner post-login "hello # { world"\n    }\n}'),
  ).not.toThrow();
});

test("rejects empty, multiple, or malformed braces and comment-only input", () => {
  expect(() => validateConfig("")).toThrow(/file is empty/);
  expect(() => validateConfig("system { junk }")).toThrow(/opening and closing curly bracket/);
  expect(() => validateConfig("system { {")).toThrow(/multiple opening braces/);
  expect(() => validateConfig("system } }")).toThrow(/multiple closing braces/);
  expect(() => validateConfig("# only a comment")).toThrow(/no configuration statements/);
  expect(() => validateConfig("system {\n    value }\n}")).toThrow(
    /closing curly bracket must be alone/,
  );
});
