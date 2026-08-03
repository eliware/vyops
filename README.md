# VyOps

Node.js GitOps deployer for VyOS native configuration files.

## Usage

```sh
./vyops.mjs vyos@core1 /path/to/config.boot
```

The deployer:

1. Connects with SSH keys via `ssh2`.
2. Uploads the native VyOS config to `/home/vyos`.
3. Loads it into the candidate configuration.
4. Prints the `compare` output.
5. Runs `commit-confirm`.
6. Confirms, saves, exits, and removes the temporary remote file.

Exit code `0` means deployment completed. Non-zero means failure.

## Development

```sh
npm install
npm test
npm run lint
```

Preflight a config without changing it:

```sh
./preflight.mjs /path/to/config.boot
```

Fix line endings, indentation, trailing whitespace, and sibling statement ordering in place:

```sh
./preflight.mjs --fix /path/to/config.boot
```

Config files may contain secrets. Do not print or commit deployment logs containing config contents.
