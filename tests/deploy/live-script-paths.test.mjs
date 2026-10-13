import { unmanagedPaths } from "../../src/deploy/live-script-paths.mjs";

test("finds live files absent from the managed manifest", () => {
  expect(
    unmanagedPaths("/config/scripts/hook.sh\0/config/scripts/manual.sh\0", new Set(["hook.sh"])),
  ).toEqual(["manual.sh"]);
});

test.each(["/config/scripts/../outside.sh\0", "/etc/passwd\0"])(
  "rejects unsafe live paths: %s",
  (output) => {
    expect(() => unmanagedPaths(output, new Set())).toThrow(/outside|unsafe script path/);
  },
);
