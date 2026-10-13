import { parseSpecialArgs } from "../src/args-special.mjs";
import { parseArgs } from "../src/args.mjs";

test("parses standalone help and version modes", () => {
  expect(parseSpecialArgs(["--help"])).toEqual({ help: true });
  expect(parseSpecialArgs(["--version"])).toEqual({ version: true });
  expect(parseArgs(["--help"])).toEqual({ help: true });
  expect(parseArgs(["--version"])).toEqual({ version: true });
});

test("leaves other argument lists for command parsing", () => {
  expect(parseSpecialArgs([])).toBeNull();
  expect(parseSpecialArgs(["--help", "release"])).toBeNull();
});
