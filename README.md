# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/vyops [![npm](https://img.shields.io/npm/v/@eliware/vyops)](https://www.npmjs.com/package/@eliware/vyops) [![License](https://img.shields.io/github/license/eliware/vyops)](https://github.com/eliware/vyops/blob/main/LICENSE) [![CI](https://github.com/eliware/vyops/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/vyops/actions/workflows/ci.yaml)

Preflight, release, and back up native VyOS configuration bundles over SSH.

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
- [Links](#links)
- [License](#license)

## Features

VyOps validates local VyOS configuration bundles and scripts. It can release a bundle over SSH, back up router state, and push confirmed state to Git. This repository owns the VyOps CLI, its tests, and its documentation.

Preflight checks local configuration and scripts before an SSH connection. Release uses candidate configuration, `compare`, and `commit-confirm` before it saves router state.

## Requirements

- Node.js 26 or later.
- npm 12 or later for repository validation.
- SSH access to a VyOS router with a trusted host key.
- A Git working tree when release pushback is enabled.

## Setup

Install the public package:

```sh
npm install --global @eliware/vyops
```

The `vyops` command runs `bin/vyops`. The package version comes from `package.json`. The npm badge shows the published version. A package version is not available from npm until an authorized release completes.

## Usage

Check a bundle without an SSH connection:

```sh
vyops preflight /path/to/config.boot
```

Release a bundle after review:

```sh
vyops release --yes /path/to/config.boot
```

Back up the active configuration and scripts from a router:

```sh
vyops backup vyos@router /path/to/backup
```

The configuration must use native VyOS syntax. It must define one host name and one login user. Release derives the SSH target from these values. See [Release Notes](RELEASE_NOTES.md) for version changes.

## Development

Use Node.js 26 or later and npm 12 or later. Install locked dependencies and run shared validation:

```sh
npm ci
npm test
```

Run `npm run lint`, `npm run format:check`, `npm run audit`, or `npm run pack` for one validation stage. Run `npm run format` to change supported files.

Source modules live in `src/`. Command entrypoints live in `bin/`. Mirrored Jest tests live in `tests/`. Read [AGENTS.md](AGENTS.md), the [documentation index](docs/README.md), and the [specification index](specs/README.md) before you change the project.

Ubuntu CI validates Node.js 26. Windows runs during development. macOS support is inferred from Node.js and POSIX behavior; CI does not test macOS.

## Testing

`npm test` runs Eliware validation, Jest tests, and coverage. Tests use local fixtures and mocked SSH operations. The live backup test runs when `VYOPS_LIVE_TARGET` and `VYOPS_LIVE_BACKUP_DEST` are set. `VYOPS_LIVE_PASSWORD` is optional.

The live release test changes router state. It runs only when `VYOPS_LIVE_RELEASE_TARGET`, `VYOPS_LIVE_RELEASE_CONFIG`, and `VYOPS_LIVE_RELEASE_CONFIRM=I_UNDERSTAND` are set. `VYOPS_LIVE_RELEASE_PASSWORD` is optional. Do not set these variables unless you intend to run a live release.

Do not set live test variables for routine validation. Tests do not change a router unless the operator enables the live test.

## Troubleshooting

Run `vyops --help` for command syntax. Add `--debug` to preflight or release to view operation phases. Debug output must not contain passwords or private keys.

Preflight reports local configuration, script, and manifest errors. Release reports router checks after it connects. Check the target host key and SSH access when connection setup fails.

## Security

Keep configuration files, router output, logs, and SSH keys private. Do not pass passwords as command arguments. Use `--password-stdin` to provide an SSH password through standard input.

For backup, run `vyops backup --password-stdin vyos@router /path/to/backup`. For release, add `--password-stdin` before the configuration path.

Keep SSH host verification enabled. Use a least-privilege router account. Review configuration diffs before release.

## Configuration

Runtime settings and defaults are listed in `.env.example`. The app reads process environment variables and does not load `.env` files. Runtime settings are separate from `package.json` metadata and CLI arguments.

| Variable                      | Default              | Purpose                                                                     |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `VYOPS_SSH_KEY`               | `$HOME/.ssh/id_rsa`  | Private SSH key path.                                                       |
| `SSH_AUTH_SOCK`               | Unset                | SSH agent socket.                                                           |
| `SSH_KNOWN_HOSTS`             | `~/.ssh/known_hosts` | Trusted host keys.                                                          |
| `SSH_HOST_CA`                 | Unset                | Trusted SSH host certificate authority.                                     |
| `VYOPS_CONNECT_TIMEOUT`       | `30000`              | SSH connect timeout in milliseconds.                                        |
| `VYOPS_OPERATION_TIMEOUT`     | `60000`              | SSH operation timeout in milliseconds.                                      |
| `VYOPS_INTERACTIVE_TIMEOUT`   | `60000`              | Interactive command timeout in milliseconds.                                |
| `LOG_LEVEL`                   | `info`               | Log level: `error`, `warn`, `info`, `http`, `verbose`, `debug`, or `silly`. |
| `VYOPS_LIVE_TARGET`           | Unset                | Live backup test target.                                                    |
| `VYOPS_LIVE_BACKUP_DEST`      | Unset                | Live backup test destination.                                               |
| `VYOPS_LIVE_PASSWORD`         | Unset                | Optional live backup password.                                              |
| `VYOPS_LIVE_RELEASE_TARGET`   | Unset                | Live release test target.                                                   |
| `VYOPS_LIVE_RELEASE_CONFIG`   | Unset                | Live release test config path.                                              |
| `VYOPS_LIVE_RELEASE_CONFIRM`  | Unset                | Release test opt-in value.                                                  |
| `VYOPS_LIVE_RELEASE_PASSWORD` | Unset                | Optional live release password.                                             |

Optional variables are commented out in `.env.example`. Set them in the process environment. The app does not load `.env` files.

## Operations

VyOps starts through `bin/vyops`. Preflight reads local files and makes no SSH connection. Release runs preflight before it checks Git state or connects. Shutdown closes active SSH sessions.

The externally observable workflows are preflight, release, and backup. Release uploads a candidate configuration, shows the router diff, and uses `commit-confirm`. It confirms and saves after the router accepts the candidate. It downloads the confirmed configuration and pushes the resulting change to the current Git repository unless `--no-pushback` is set.

Preflight is read-only and does not modify router state. Backup reads router state. Release changes router state only after `--yes` confirms the target summary.

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

Run all commands from the target repository root. Validation workflows use GitHub CLI to inspect CI status.

## Exit codes

Exit code `0` means success. A non-zero code means argument, validation, connection, or operation failure. Error output omits passwords and private key data.

## Support

For help, questions, or to chat with the author and community, visit:

[![Discord](https://eliware.org/logos/discord_96.png)](https://discord.gg/M6aTR9eTwN)[![eliware.org](https://eliware.org/logos/eliware_96.png)](https://discord.gg/M6aTR9eTwN)

**[eliware.org on Discord](https://discord.gg/M6aTR9eTwN)**

## Links

- [Home Page](https://eliware.org)
- [GitHub Org](https://github.com/eliware)
- [GitHub Repo](https://github.com/eliware/vyops)
- [Bug Reports](https://github.com/eliware/vyops/issues)
- [npm](https://www.npmjs.com/package/@eliware/vyops)
- [Discord](https://discord.gg/M6aTR9eTwN)

## License

[MIT © Eliware](LICENSE)
