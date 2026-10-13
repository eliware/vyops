import { readCommandTokens } from "../src/args-tokens.mjs";

test("collects options from both sides of a command", () => {
  expect(
    readCommandTokens(["--debug", "backup", "--password-stdin", "vyos@router", "/tmp"], "Usage"),
  ).toEqual({
    command: "backup",
    options: new Set(["--debug", "--password-stdin"]),
    values: ["vyos@router", "/tmp"],
  });
});

test("rejects input that has no command token", () => {
  expect(() => readCommandTokens(["--debug"], "Usage")).toThrow("Usage");
});
