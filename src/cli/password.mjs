export async function readPasswordStdin(input) {
  const chunks = [];
  for await (const chunk of input) chunks.push(chunk);
  const password = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
  if (!password) throw new Error("password-stdin received an empty password");
  return password;
}
