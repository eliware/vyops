export async function readPasswordText(input) {
  const chunks = [];
  for await (const chunk of input) chunks.push(chunk);
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}
