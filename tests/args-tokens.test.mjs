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

test("accepts positional values that start with a dash after the option marker", () => {
  expect(readCommandTokens(["preflight", "--", "--config.boot"], "Usage")).toEqual({
    command: "preflight",
    options: new Set(),
    values: ["--config.boot"],
  });
});

test("rejects input that has no command token", () => {
  expect(() => readCommandTokens(["--debug"], "Usage")).toThrow("Usage");
});
