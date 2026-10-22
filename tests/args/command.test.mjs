import { selectCommand } from "../../src/args/command.mjs";

test("selects the first command after options and delimiters", () => {
  expect(selectCommand(["--debug", "--", "backup", "--force"], "Usage")).toEqual({
    command: "backup",
    valueStart: 3,
  });
});

test("reports the supplied usage when no command exists", () => {
  expect(() => selectCommand(["--debug", "--"], "Usage")).toThrow("Usage");
});
