import { scriptExecutablePolicy } from "../../../src/bundle/script/executable-policy.mjs";

test.each([
  ["config.txt", 0o644, "data", { binary: false, executable: false }],
  ["helper.sh", 0o644, "data", { binary: false, executable: true }],
  ["tool.exe", 0o644, "data", { binary: true, executable: true }],
  ["commit/post-hooks.d/hook", 0o644, "data", { binary: false, executable: true }],
  ["plain", 0o755, "data", { binary: false, executable: true }],
])("classifies script %s", (name, mode, firstLine, expected) => {
  expect(scriptExecutablePolicy(name, mode, firstLine)).toEqual(expected);
});
