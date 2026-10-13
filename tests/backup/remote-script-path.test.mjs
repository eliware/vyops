import { remoteScriptPath } from "../../src/backup/remote-script-path.mjs";

test("accepts a systemd template path with an at sign", () => {
  expect(remoteScriptPath("/config/scripts/systemd/agent@.service")).toBe("systemd/agent@.service");
});

test("rejects a remote script path with traversal", () => {
  expect(() => remoteScriptPath("/config/scripts/../private")).toThrow("unsafe remote script path");
});
