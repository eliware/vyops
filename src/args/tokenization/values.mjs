export function readCommandValues(argv, valueStart, valueTerminator) {
  const valueEnd = valueTerminator === -1 ? argv.length : valueTerminator;
  const values = argv.slice(valueStart, valueEnd).filter((value) => !value.startsWith("--"));
  if (valueTerminator !== -1) values.push(...argv.slice(valueTerminator + 1));
  return values;
}
