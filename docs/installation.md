# Installation

## Requirements

Use Node.js 26 or later.
Use npm 12 or later to install the package.
Use a VyOS router with a trusted SSH host key for release and backup.

## Install the package

Install the public package for all users:

```sh
npm install --global @eliware/vyops
```

Check the installed version:

```sh
vyops --version
```

Read command syntax:

```sh
vyops --help
```

The executable name is `vyops`.
The package entrypoint is `bin/vyops`.

## Package contents

The package contains `bin/`, `src/`, `docs/`, and `specs/`.
It also contains `.env.example` with optional settings and placeholder values.
It also contains README.md, AGENTS.md, LICENSE, and RELEASE_NOTES.md.
It does not contain tests, CI files, or the package lockfile.

## Release limits

Only an approved release owner can publish a package version.
Validation does not authorize npm publication.
VyOps does not publish the package during a router release.
