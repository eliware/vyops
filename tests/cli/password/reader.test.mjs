import { Readable } from "node:stream";
import { readPasswordText } from "../../../src/cli/password/reader.mjs";

test("collects stream chunks and removes the final line ending", async () => {
  const input = Readable.from([Buffer.from("sec"), Buffer.from("ret\r\n")]);
  await expect(readPasswordText(input)).resolves.toBe("secret");
});
