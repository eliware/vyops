import { validatePassword } from "../../../src/cli/password/validation.mjs";

test("accepts a nonempty password", () => {
  expect(validatePassword("secret")).toBe("secret");
});

test("rejects an empty password", () => {
  expect(() => validatePassword("")).toThrow("password-stdin received an empty password");
});
