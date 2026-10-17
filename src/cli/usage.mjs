export const usage = [
  "Usage:",
  "  vyops preflight [--debug] <config.boot>",
  "  vyops release --yes [--force] [--debug] [--verify] [--verify-binaries]",
  "    [--no-pushback] [--no-hooks requires --force] [--password-stdin] <config.boot>",
  "  vyops backup [--debug] [--password-stdin] <user@hostname-or-ip>",
  "    <destination-directory>",
  "  vyops --help",
  "  vyops --version",
].join("\n");
