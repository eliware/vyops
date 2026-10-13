import { hasNoWireGuardInterfaces } from "../../src/deploy/wireguard-status.mjs";

test("detects a WireGuard table with no interface rows", () => {
  expect(hasNoWireGuardInterfaces("Interface  IP Address\n---------  ----------\n")).toBe(true);
});

test.each([
  "unavailable",
  "Interface  IP Address\n",
  "Interface  IP Address\n---------  ----------\nwg0  192.0.2.1/24\n",
])("does not report an empty interface table for %s", (output) => {
  expect(hasNoWireGuardInterfaces(output)).toBe(false);
});
