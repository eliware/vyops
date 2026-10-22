import { Readable } from "node:stream";
import { readPasswordStdin } from "../../src/cli/password.mjs";

test("reads and validates a password from stdin", async () => {
  await expect(readPasswordStdin(Readable.from([Buffer.from("secret\n")]))).resolves.toBe("secret");
});
