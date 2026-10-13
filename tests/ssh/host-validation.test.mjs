import { isValidHost } from "../../src/ssh/host-validation.mjs";

test.each(["router", "router.example.test", "192.0.2.1", "2001:db8::1", "[2001:db8::1]"])(
  "accepts host form %s",
  (host) => expect(isValidHost(host)).toBe(true),
);

test.each(["", "bad host", "bad/host", "[bad]", "[:::]", "[gggg::1]", undefined])(
  "rejects invalid host form %p",
  (host) => expect(isValidHost(host)).toBe(false),
);
