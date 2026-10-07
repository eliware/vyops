import { targetFromConfig } from "../../src/bundle/target.mjs";

test("extracts the target from native VyOS configuration", () => {
  expect(
    targetFromConfig("system {\n  host-name router\n  login {\n    user vyos {\n    }\n  }\n}\n"),
  ).toBe("vyos@router");
  expect(
    targetFromConfig(
      'system {\n  host-name "router-one" # comment\n  login {\n    user vyos {\n    }\n  }\n}\n',
    ),
  ).toBe("vyos@router-one");
});

test.each([
  ["system {}", "config does not define system host-name"],
  ["system {\n host-name router\n}", "expected exactly one system login user; found 0"],
  [
    "system {\n host-name router\n login {\n user a {\n }\n user b {\n }\n }\n}",
    "expected exactly one system login user; found 2",
  ],
  ["system {\n host-name router\n", "config does not define system host-name"],
])("rejects invalid target configuration", (text, message) => {
  expect(() => targetFromConfig(text)).toThrow(message);
});
