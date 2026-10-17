# Command use

## Help and version

Print help:

```sh
vyops --help
```

Print the installed version:

```sh
vyops --version
```

Use these options alone. Do not add a command or a second option.

## Commands

Check a bundle without an SSH connection:

```sh
vyops preflight [--debug] <config.boot>
```

Release a bundle to its configured router:

```sh
vyops release --yes [options] <config.boot>
```

Save router config and scripts:

```sh
vyops backup [--debug] [--password-stdin] <user@host> <directory>
```

Options can appear before or after the command name.
Use `--help` for the canonical command syntax.

## Options

| Option              | Command           | Result                                           |
| ------------------- | ----------------- | ------------------------------------------------ |
| `--debug`           | All commands      | Show safe debug details.                         |
| `--password-stdin`  | Release or backup | Read an SSH password from standard input.        |
| `--yes`             | Release           | Required acknowledgment before release.          |
| `--force`           | Release           | Do not skip an unchanged pushback release.       |
| `--verify`          | Release           | Check VRRP, WireGuard, BGP, routes, and HAProxy. |
| `--verify-binaries` | Release           | Compare SHA-256 hashes for binary scripts.       |
| `--no-pushback`     | Release           | Do not push confirmed router state to Git.       |
| `--no-hooks`        | Release           | Do not sync scripts. Requires `--force`.         |

Preflight does not accept `--password-stdin` because it does not use a password.

`--force` also lets pushback remove a stale local lock.
Use it only when no other VyOps pushback runs in the repository.

## Arguments

`<config.boot>` names the local VyOS config file.
VyOps finds the `scripts/` folder beside that file.
Release gets its SSH target from the config.

`<user@host>` names a backup target.
Use a DNS name, an IPv4 address, or a bracketed IPv6 address.
Use a user name with letters, digits, period, underscore, or hyphen.

`<directory>` names the local backup folder.
Do not use a filesystem root as the backup destination.
Put `--` before a path that starts with a hyphen.

## Password input

Use `--password-stdin` when the router uses password authentication.
Send one password line through standard input.
VyOps removes one final newline and rejects empty input.
Do not put a password in a command argument or shell history.
