import { parseTarget } from "../../src/ssh/target.mjs";

test.each([
  ["vyos@router.example.test", { username: "vyos", host: "router.example.test" }],
  ["admin@[2001:db8::1]", { username: "admin", host: "[2001:db8::1]" }],
])("parses %s", (target, expected) => {
  expect(parseTarget(target)).toEqual(expected);
});

test.each([
  undefined,
  "",
  "router",
  "router.example.test",
  "@router",
  "admin@bad host",
  "bad/user@router",
  "admin@",
  "vyos@",
  "vyos@router@other",
  "vyos@2001:db8::1",
  "vy os@router",
  "vyos@bad/host",
  "vyos@[bad]",
  "vyos@[:::]",
  "vyos@[gggg::1]",
])("rejects invalid target %p", (target) => {
  expect(() => parseTarget(target)).toThrow("invalid target; expected user@host");
});
