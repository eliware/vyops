import { jest } from "@jest/globals";

const listScripts = jest.fn();
jest.unstable_mockModule("../../../src/deploy/script/tree.mjs", () => ({ listScripts }));
const { discoverScriptNames } = await import("../../../src/deploy/script/discovery.mjs");

afterEach(() => listScripts.mockReset());

test("returns sorted script names from discovery", async () => {
  listScripts.mockResolvedValue(["a.sh", "nested/b.sh"]);
  await expect(discoverScriptNames({}, () => {}, "/scripts")).resolves.toEqual([
    "a.sh",
    "nested/b.sh",
  ]);
});

test("returns a missing script tree unchanged", async () => {
  listScripts.mockResolvedValue(null);
  await expect(discoverScriptNames({}, () => {}, "/scripts")).resolves.toBeNull();
});

test("rejects unsafe discovered script paths", async () => {
  listScripts.mockResolvedValue(["../outside.sh"]);
  await expect(discoverScriptNames({}, () => {}, "/scripts")).rejects.toThrow(
    "script path is invalid",
  );
});
