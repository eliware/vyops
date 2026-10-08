# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

@eliware/vyops [![npm](https://img.shields.io/npm/v/@eliware/vyops)](https://www.npmjs.com/package/@eliware/vyops) [![License](https://img.shields.io/github/license/eliware/vyops)](https://github.com/eliware/vyops/blob/main/LICENSE) [![CI](https://github.com/eliware/vyops/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/vyops/actions/workflows/ci.yaml)

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Configuration](#configuration)
- [Operations](#operations)
- [Commands](#commands)
- [Exit codes](#exit-codes)
- [Support](#support)
- [License](#license)
- [Links](#links)

## Features

VyOps preflights, releases, and backs up native VyOS configuration bundles over SSH. The package synchronizes script files and pushes confirmed router state to Git. This repository owns the VyOps CLI, its tests, and its docs.

The CLI validates local configuration and scripts before it connects. Release uses candidate configuration, `compare`, and `commit-confirm` before it saves router state.

## Requirements

- Node.js 26.
- npm 12 or newer for repository validation.
- SSH access to a VyOS router with a trusted host key.
- A Git working tree when release pushback is enabled.

The package description is: `Preflight, release, and back up native VyOS configuration bundles over SSH.` The package author is `Eliware <eliware@eliware.org>`. The license is MIT.

## Setup

Install the public package:

```sh
npm install --global @eliware/vyops
```

The `vyops` command runs `bin/vyops`. The repository version source is `package.json`. The npm badge shows the published version. A package version in the repository is not available from npm until an authorized release completes.

## Usage

Check a bundle without an SSH connection:

```sh
vyops preflight /path/to/config.boot
```

Release a bundle after review:

```sh
vyops release --yes /path/to/config.boot
```

Back up the active config and scripts from a router:

```sh
vyops backup vyos@router /path/to/backup
```

The config must use native VyOS syntax. It must define one host name and one login user. Release derives the SSH target from these values.

## Development

Use Node.js 26 and npm 12 or newer. Install locked dependencies and run shared validation:

```sh
npm ci
npm test
```

Run `npm run lint`, `npm run format:check`, `npm run audit`, or `npm run pack` for one validation stage. `npm run format` changes supported files.

Supported platforms are Linux and Windows. Ubuntu CI tests Node.js 26. Windows runs during development. macOS support is inferred from Node.js and POSIX behavior; CI does not test macOS. Validation evidence: run `npm test` and check the CI workflow.

## Testing

`npm test` runs Eliware validation, Jest tests, and coverage. Tests use local fixtures and mocked SSH operations. The live backup test runs when `VYOPS_LIVE_TARGET` and `VYOPS_LIVE_BACKUP_DEST` are set. `VYOPS_LIVE_PASSWORD` is optional.

The live release test changes router state. It runs only when `VYOPS_LIVE_RELEASE_TARGET`, `VYOPS_LIVE_RELEASE_CONFIG`, and `VYOPS_LIVE_RELEASE_CONFIRM=I_UNDERSTAND` are set. `VYOPS_LIVE_RELEASE_PASSWORD` is optional. Do not set these variables unless you intend to run a live release.

Do not set live test variables for routine validation. Tests do not change a router unless the operator enables the live test.

## Troubleshooting

Run `vyops --help` for command syntax. Add `--debug` to preflight or release to view operation phases. Debug output must not contain passwords or private keys.

Preflight reports local config, script, and manifest errors. Release reports router checks after it connects. Check the target host key and SSH access when connection setup fails.

## Security

Keep config files, router output, logs, and SSH keys private. Do not pass passwords as command arguments. Use `--password-stdin` to provide an SSH password through standard input.

Keep SSH host verification enabled. Use a least-privilege router account. Review config diffs before release.

## Configuration

Runtime settings and defaults are listed in `.env.example`. The app reads process environment variables and does not load `.env` files. Runtime settings are separate from `package.json` metadata and CLI arguments.

| Variable                    | Default              | Purpose                                                                     |
| --------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `VYOPS_SSH_KEY`             | `$HOME/.ssh/id_rsa`  | Private SSH key path.                                                       |
| `SSH_AUTH_SOCK`             | Unset                | SSH agent socket.                                                           |
| `SSH_KNOWN_HOSTS`           | `~/.ssh/known_hosts` | Trusted host keys.                                                          |
| `SSH_HOST_CA`               | Unset                | Trusted SSH host certificate authority.                                     |
| `VYOPS_CONNECT_TIMEOUT`     | `30000`              | SSH connect timeout in milliseconds.                                        |
| `VYOPS_OPERATION_TIMEOUT`   | `60000`              | SSH operation timeout in milliseconds.                                      |
| `VYOPS_INTERACTIVE_TIMEOUT` | `60000`              | Interactive command timeout in milliseconds.                                |
| `LOG_LEVEL`                 | `info`               | Log level: `error`, `warn`, `info`, `http`, `verbose`, `debug`, or `silly`. |

Optional variables are commented out in `.env.example`. Set them in the process environment. The app does not load `.env` files.

## Operations

VyOps starts through `bin/vyops`. Preflight reads local files and makes no SSH connection. Release runs preflight before it checks Git state or connects. Shutdown closes active SSH sessions.

Startup begins in `bin/vyops`. The externally observable workflows are preflight, release, and backup. Release uploads a candidate config, shows the router diff, and uses `commit-confirm`. It confirms and saves after the router accepts the candidate. It downloads the confirmed config and pushes the resulting change to the current Git repository unless `--no-pushback` is set. Shutdown closes active SSH sessions.

Operations boundaries: preflight makes no connection. Backup reads router state. Release changes router state after `--yes` confirms the target summary.

Use `--no-hooks` only with `--force`. This option skips all synchronized scripts. Do not run releases against `core1` and `core2` at the same time.

For an authorized npm release, follow the Operations release handoff. Eli and the project developer run TagIt preflight together. Eli approves the release and instructs DevOps. DevOps runs the authorized release. An agent must not publish without explicit authorization.

## Commands

| Command                             | Action                                           |
| ----------------------------------- | ------------------------------------------------ |
| `vyops preflight <config.boot>`     | Validate local config, scripts, and manifest.    |
| `vyops release --yes <config.boot>` | Release the config to its derived router target. |
| `vyops backup <target> <directory>` | Back up the active config and scripts.           |
| `vyops --help`                      | Print command usage.                             |
| `vyops --version`                   | Print the package version.                       |

Release options include `--force`, `--debug`, `--verify`, `--verify-binaries`, `--no-pushback`, `--no-hooks`, and `--password-stdin`. `--no-hooks` requires `--force`. Release requires `--yes`.

## Exit codes

Exit code `0` means success. A non-zero code means argument, validation, connection, or operation failure. Error output omits passwords and private key data.

## Support

Open a focused issue at the GitHub repository. Include the command, a redacted error, and the VyOps version. Do not attach secrets or full router configs.

[![Discord](https://eliware.org/logos/discord_96.png)](https://discord.gg/M6aTR9eTwN)

**[eliware.org on Discord](https://discord.gg/M6aTR9eTwN)**

## License

MIT License. See [LICENSE](LICENSE).

## Links

Documentation: [docs](docs/README.md) and [specifications](specs/README.md).

- [Home Page](https://github.com/eliware/vyops#readme)
- [GitHub repository](https://github.com/eliware/vyops.git)
- [Eliware](https://eliware.org)
- [GitHub organization](https://github.com/eliware)
- [Discord](https://discord.gg/M6aTR9eTwN)
- [docs](docs/README.md)
- [specifications](specs/README.md)
- [Release Notes](RELEASE_NOTES.md)
- [npm Package](https://www.npmjs.com/package/@eliware/vyops)
