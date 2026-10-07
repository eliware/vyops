import { parseTarget } from "../../src/ssh/target.mjs";

test.each([
  ["vyos@router.example.test", { username: "vyos", host: "router.example.test" }],
  ["admin@[2001:db8::1]", { username: "admin", host: "[2001:db8::1]" }],
])("parses %s", (target, expected) => {
  expect(parseTarget(target)).toEqual(expected);
});

test.each(["", "router.example.test", "@router", "admin@", "admin@bad host", "bad/user@router"])(
  "rejects invalid target %s",
  (target) => {
    expect(() => parseTarget(target)).toThrow("invalid target; expected user@host");
  },
);

test.each([
  undefined,
  "",
  "router",
  "@router",
  "vyos@",
  "vyos@router@other",
  "vy os@router",
  "vyos@bad/host",
  "vyos@[bad]",
])("rejects invalid target %p", (target) => {
  expect(() => parseTarget(target)).toThrow("invalid target; expected user@host");
});

test("accepts valid target forms", () => {
  expect(parseTarget("vyos@router.example")).toEqual({ username: "vyos", host: "router.example" });
  expect(parseTarget("vyos@192.0.2.1")).toEqual({ username: "vyos", host: "192.0.2.1" });
  expect(parseTarget("vyos@[2001:db8::1]")).toEqual({ username: "vyos", host: "[2001:db8::1]" });
});
