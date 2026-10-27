import { redactSensitiveValues } from "../../src/security/redact.mjs";

test("redacts known secrets and common secret fields", () => {
  const value = 'hunter2 password=hunter2 token "abc" Authorization: Bearer secret';
  const result = redactSensitiveValues(value, "hunter2");
  expect(result).not.toContain("hunter2");
  expect(result).toContain("[redacted]");
});

test("redacts private key blocks", () => {
  const result = redactSensitiveValues("-----BEGIN PRIVATE KEY-----x-----END PRIVATE KEY-----");
  expect(result).toBe("[private-key redacted]");
});

test("redacts secret fields when no explicit secret value is supplied", () => {
  expect(redactSensitiveValues("secret=abc token=xyz")).toBe("secret=[redacted] token=[redacted]");
});
