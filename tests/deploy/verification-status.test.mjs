const { optionalVerificationStatus } = await import("../../src/deploy/verification-status.mjs");

test.each([
  ["show vrrp", "VRRP data is not available (process not running or no active groups)"],
  ["show bgp summary", "% BGP instance not found"],
  ["show haproxy", "Haproxy is not configured"],
])("treats absent optional service as non-blocking for %s", (command, output) => {
  expect(optionalVerificationStatus(command, output, 1)).toBe(
    "optional check is not configured or active",
  );
});

test("treats an empty WireGuard table as no configured interfaces", () => {
  const output = "Interface        IP Address\n---------        ----------\n";
  expect(optionalVerificationStatus("show interfaces wireguard", output, 0)).toBe(
    "no WireGuard interfaces are configured",
  );
});

test("does not classify operational failures or route checks as optional absence", () => {
  expect(optionalVerificationStatus("show bgp summary", "connection refused")).toBeNull();
  expect(
    optionalVerificationStatus(
      "show vrrp",
      "VRRP data is not available (process not running or no active groups)",
      0,
    ),
  ).toBeNull();
  expect(
    optionalVerificationStatus(
      "show bgp summary",
      "% BGP instance not found\noperation failed: permission denied",
      1,
    ),
  ).toBeNull();
  expect(
    optionalVerificationStatus(
      "show bgp summary",
      "BGP instance not found\noperation failed: permission denied",
    ),
  ).toBeNull();
  expect(optionalVerificationStatus("show ip route", "")).toBeNull();
});
