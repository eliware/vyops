import { jest } from "@jest/globals";
import { createDeploymentLogger } from "../../src/deploy/logger.mjs";

test("logs deployment phases and redacts the password", () => {
  const log = { debug: jest.fn() };
  const client = {};
  const logger = createDeploymentLogger(log, "run-id", "secret", () => client);
  logger.phase("connect");
  logger.debugLog("password=secret");
  expect(client.__vyopsPhase).toBe("connect");
  expect(log.debug.mock.calls[1][0]).not.toContain("secret");
});
