import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import { redactDeploymentOutput } from "../../src/deploy/redact.mjs";

test("redacts password values and private keys", () => {
  const value = `password=hunter2\nAuthorization: token\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----`;
  expect(redactDeploymentOutput(value, "hunter2")).not.toContain("hunter2");
  expect(redactDeploymentOutput(value, "hunter2")).toContain("[redacted]");
});

const { logMock, mocks, deploy } = await setupDeployHarness(jest);

test("redacts secrets across the deployment debug and output paths", async () => {
  const secret = "deployment-secret-value";
  mocks.interactive.mockImplementation(async (_client, commands, debug, onComplete) => {
    onComplete?.("confirm");
    debug(`remote transcript contains ${secret}`);
    return `vyos# compare\n+ secret ${secret}\n+ password=router-password token router-token\nvyos# printf x`;
  });
  mocks.exec.mockImplementation(async (_client, command) =>
    command.startsWith("vbash -ic")
      ? {
          code: 0,
          stdout: `verification ${secret} password=verify-password token verify-token`,
          stderr: "",
        }
      : { code: 0, stdout: "", stderr: "" },
  );
  await expect(
    deploy({ target: "vyos@router", config: "/tmp/config.boot", password: secret, verify: true }),
  ).resolves.toBe(0);
  const output = JSON.stringify([...logMock.debug.mock.calls, ...logMock.info.mock.calls]);
  expect(output).not.toContain(secret);
  expect(output).not.toContain("router-password");
  expect(output).not.toContain("verify-password");
  expect(output).not.toContain("router-token");
  expect(output).not.toContain("verify-token");
  expect(output).toContain("[redacted]");
});

test("redacts quoted and header-style secrets from verification output", async () => {
  mocks.exec.mockImplementation(async (_client, command) =>
    command.startsWith("vbash -ic")
      ? {
          code: 0,
          stdout:
            "Password: \"quoted-secret\" TOKEN: 'single-secret' authorization: Bearer-secret x-api-key: api-secret",
          stderr: "",
        }
      : { code: 0, stdout: "", stderr: "" },
  );
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      verify: true,
    }),
  ).resolves.toBe(0);
  const output = logMock.info.mock.calls.flat().join("\n");
  expect(output).not.toMatch(/quoted-secret|single-secret|Bearer-secret|api-secret/);
  expect(output).toContain("[redacted]");
});
