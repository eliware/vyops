export function fail(line, message) {
  throw new Error(`config validation failed at line ${line}: ${message}`);
}
