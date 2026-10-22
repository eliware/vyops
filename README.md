# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/vyops [![npm](https://img.shields.io/npm/v/@eliware/vyops)](https://www.npmjs.com/package/@eliware/vyops) [![License](https://img.shields.io/github/license/eliware/vyops)](https://github.com/eliware/vyops/blob/main/LICENSE) [![CI](https://github.com/eliware/vyops/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/vyops/actions/workflows/ci.yaml)

Preflight local VyOS bundles. Release bundles with SSH. Copy router configuration and scripts with SSH.

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

VyOps checks local bundles before release. It can save router configuration and scripts with SSH.
It can save confirmed router state to Git.

## Requirements

- Use Node.js 26 or later.
- Use npm 12 or later to validate this repository.
- Give the router a trusted SSH host key.

## Setup

Install the public package:

```sh
npm install --global @eliware/vyops
```

The `vyops` command runs `bin/vyops`.
The package includes `bin/`, `src/`, `docs/`, `specs/`, `.env.example`, and project records.
Only an approved release owner can publish a new package version.
Read the [installation guide](docs/installation.md) for package contents and release limits.

## Usage

Run `vyops preflight` to check a local bundle. Run `vyops release` to send it to a router.
Run `vyops backup` to save the active config and scripts.

Read the [usage guide](docs/usage.md), [bundle guide](docs/bundle.md), and
[specification index](specs/README.md) for details.
Use the [documentation index](docs/README.md) to find each user guide.
Read [release notes](RELEASE_NOTES.md) for version changes.

## Development

Use Node.js 26 or later and npm 12 or later.
Read [AGENTS.md](AGENTS.md) and [specifications](specs/README.md) before you change this repository.

Install locked dependencies:

```sh
npm ci
```

Run aggregate validation:

```sh
npm test
```

## Testing

`npm test` runs repository checks and Jest tests.
The tests mock SSH and Git commands. They do not connect to a router.

## Troubleshooting

Read the [troubleshooting guide](docs/troubleshooting.md) for typical errors.
Use `vyops --help` to view command syntax.

## Security

Keep router config, backups, logs, and SSH keys private.
Do not pass a password as a command-line value.
Use `--password-stdin` for SSH password input.
Read the [safe release guidance](docs/release.md#security) before a release.

## Configuration

Set runtime options with process environment variables.
VyOps does not load `.env` files.
Read the [configuration guide](docs/configuration.md) for names and defaults.

## Operations

The command starts through `bin/vyops`.
It closes active SSH connections before it exits.
Preflight checks local files and makes no SSH connection.
Release runs preflight before Git checks or SSH setup.
Backup reads router data and writes a local backup.
Read the [preflight](docs/preflight.md), [release](docs/release.md), and
[backup](docs/backup.md) guides before you use these commands.

## Commands

| Command                                | Action                                         |
| -------------------------------------- | ---------------------------------------------- |
| `vyops preflight <config.boot>`        | Check the local config, scripts, and manifest. |
| `vyops release --yes <config.boot>`    | Send a bundle to its configured router.        |
| `vyops backup <user@host> <directory>` | Save router config and scripts.                |
| `vyops --help`                         | Print command syntax.                          |
| `vyops --version`                      | Print the package version.                     |

Read the [command guide](docs/usage.md) for options and arguments.

## Exit codes

Exit code `0` means success. Exit code `1` means an argument, validation, connection, or operation error.

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
