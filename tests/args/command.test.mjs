import { selectCommand } from "../../src/args/command.mjs";

test("selects a command before the positional value delimiter", () => {
  expect(selectCommand(["--debug", "backup", "--", "--force"], "Usage")).toEqual({
    command: "backup",
    valueStart: 2,
  });
});

test("does not select a command after a leading value delimiter", () => {
  expect(() => selectCommand(["--", "backup", "config.boot"], "Usage")).toThrow("Usage");
});

test("reports the supplied usage when no command exists", () => {
  expect(() => selectCommand(["--debug"], "Usage")).toThrow("Usage");
});
