import { transferWithTimeout } from "../../src/ssh/transfer-timeout.mjs";

afterEach(() => {
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test.each(["SSH_TIMEOUT", "SSH_TRANSFER_TIMEOUT"])(
  "maps %s to a contextual VyOps timeout",
  async (code) => {
    const error = Object.assign(new Error("timed out"), { code });
    await expect(
      transferWithTimeout(
        Promise.reject(error),
        "upload",
        "operation-id",
        { __vyopsDeploymentId: "deploy", __vyopsTarget: "router", __vyopsPhase: "upload" },
        "/remote/file",
      ),
    ).rejects.toMatchObject({
      code: "VYOPS_TIMEOUT",
      message:
        "SFTP upload timed out [operation-id] (deployment=deploy target=router phase=upload): /remote/file",
    });
  },
);

test("uses unknown context values and preserves other errors", async () => {
  const timeout = Object.assign(new Error("timed out"), { code: "SSH_TIMEOUT" });
  await expect(
    transferWithTimeout(Promise.reject(timeout), "download", "operation-id", {}, "/remote/file"),
  ).rejects.toThrow("deployment=unknown target=unknown phase=unknown");

  const failure = new Error("transfer failed");
  await expect(
    transferWithTimeout(Promise.reject(failure), "download", "operation-id", {}, "/remote/file"),
  ).rejects.toBe(failure);
});
