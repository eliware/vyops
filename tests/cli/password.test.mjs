import { Readable } from "node:stream";
import { readPasswordStdin } from "../../src/cli/password.mjs";

test("reads a password and removes the final newline", async () => {
  await expect(readPasswordStdin(Readable.from([Buffer.from("secret\r\n")]))).resolves.toBe(
    "secret",
  );
});

test("rejects empty input", async () => {
  await expect(readPasswordStdin(Readable.from([]))).rejects.toThrow(
    "password-stdin received an empty password",
  );
});
