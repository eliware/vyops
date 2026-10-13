export function relocateHeaderComments(lines) {
  const output = [...lines];
  const header = [];
  while (output[0]?.startsWith("//")) header.push(output.shift());
  while (output[0] === "") output.shift();
  while (output.at(-1) === "") output.pop();
  if (header.length) output.push("", "", ...header);
  return output;
}
