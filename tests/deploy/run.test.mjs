import { runDeployment } from "../../src/deploy/run.mjs";

test("exports the deployment workflow", () => {
  expect(typeof runDeployment).toBe("function");
});
