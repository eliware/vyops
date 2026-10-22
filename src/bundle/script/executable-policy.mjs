export function scriptExecutablePolicy(name, mode, firstLine) {
  const binary = /\.exe$/i.test(name);
  const executable =
    binary ||
    Boolean(mode & 0o111) ||
    firstLine.startsWith("#!") ||
    /(?:\.sh|\.script)$/i.test(name) ||
    /^(?:commit\/post-hooks\.d\/|vyos-(?:pre|post)config-bootup\.script$)/.test(name);
  return { binary, executable };
}
