import { withRepositoryLock } from "../../src/git/lock.mjs";

test("runs the protected action", async () => {
  await expect(withRepositoryLock(process.cwd(), async () => "done", false)).resolves.toBe("done");
});
