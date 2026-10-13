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
  expect(
    targetFromConfig(
      "system {\n  host-name 192.168.1.1\n  login {\n    user vyos {\n    }\n  }\n}\n",
    ),
  ).toBe("vyos@192.168.1.1");
});

test("ignores block-like text inside a multiline quoted system value", () => {
  const config = `system {
  note "text starts here
login {
  user attacker {
  }
}
and ends here"
  host-name router
  login {
    user vyos {
    }
  }
}`;
  expect(targetFromConfig(config)).toBe("vyos@router");
});

test.each([
  ["system {}", "config does not define system host-name"],
  ["system {\n host-name router\n}", "expected exactly one system login user; found 0"],
  [
    "system {\n host-name router\n login {\n user a {\n }\n user b {\n }\n }\n}",
    "expected exactly one system login user; found 2",
  ],
  ["system {\n host-name router\n", "config does not define system host-name"],
  [
    "system {\n host-name 999.168.1.1\n login {\n user vyos {\n }\n }\n}",
    "invalid system host-name",
  ],
])("rejects invalid target configuration", (text, message) => {
  expect(() => targetFromConfig(text)).toThrow(message);
});
