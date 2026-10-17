const { remoteScriptPath } = await import("../../../../src/backup/remote/script/path.mjs");

test("accepts a systemd template path with an at sign", () => {
  expect(remoteScriptPath("/config/scripts/systemd/agent@.service")).toBe("systemd/agent@.service");
});

test("rejects a remote script path with traversal", () => {
  expect(() => remoteScriptPath("/config/scripts/../private")).toThrow("unsafe remote script path");
});

test("rejects a listed file outside the remote script folder", () => {
  expect(() => remoteScriptPath("/tmp/other")).toThrow("unsafe remote script path");
});
