export function validateCommandPositionals(command, valueCount, usage) {
  const expectedValues = command === "backup" ? 2 : 1;
  if (valueCount !== expectedValues) throw new Error(usage);
}
