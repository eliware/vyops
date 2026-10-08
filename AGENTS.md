# AGENTS.md

## Project

The repository is `@eliware/vyops`. Its purpose is to deploy native VyOS configuration bundles over SSH, validate local bundles, synchronize scripts, and push confirmed router state to Git.

## Scope and boundaries

These rules define repository scope and boundary. They apply repository-wide. A subdirectory inherits these rules and may add an AGENTS.md file for its subdirectory instructions.

Read the root README.md, applicable AGENTS.md instructions, and applicable documentation before you change files.

The repository owns the VyOps CLI, its tests, package files, and related docs. Do not add work outside this scope without user approval.

Do not deploy to a router during tests. Do not change a router unless the user asks for deployment.

## Layout

Repository structure: source files live in `src/`, commands live in `bin/`, docs live in `docs/`, and tests live in `tests/`.

- `src/` contains the CLI, validation, SSH, deployment, backup, and Git code.
- `tests/` contains unit and integration tests.
- `docs/` contains user and developer documentation.
- `specs/` contains repository specifications.
- `bin/` contains the installed CLI entry point.

## Development

Use Node.js 26 and npm. Use native ESM with `.mjs` files. Runtime commands are `node bin/vyops` and `npm run deploy`.

Runtime environment settings are listed in README.md and `.env.example`. The app reads process environment variables; it does not load `.env` files. Package metadata belongs in `package.json`. CLI arguments do not replace runtime environment settings.

Read the affected code and its tests before you make a change. Follow single responsibility: one cohesive purpose and one reason to change.

These instructions apply repository-wide. Check for applicable subdirectory instructions before you edit files.

Read README.md, AGENTS.md, and applicable documentation before you edit files. Business-logic modules and coordinators are valid. Coordinators of coordinators are valid when each module does its own responsibility. Put each distinct responsibility in a focused submodule with a mirrored test, then wire it through its owner. Do not add the new responsibility to an existing module. During ordinary review, refactor them when they have mixed responsibilities. Passing them does not prove that mixed responsibilities are acceptable. Line counts do not prove single responsibility or permit mixed responsibilities below a maximum.

Keep changes within the VyOps CLI and its package. Do not add credentials or private data to the repository.

## Validation

Run `npm ci` after a lockfile change. Run `npm test` for code or behavior changes. Use `npm run lint`, `npm run format:check`, `npm run audit`, and `npm run pack` for focused validation.

Supported platform: Linux. Ubuntu CI validates Node.js 26. Windows runs during development. macOS support is inferred from POSIX behavior; CI does not test macOS.

Do not claim validation passed when a command failed or did not run. Tests must not connect to a live router unless the user asks for that test.

## Security

Treat configuration files and router output as sensitive. Do not log secrets, private keys, or full configuration contents.

Keep SSH host verification enabled. Use least-privilege SSH access. Do not put credentials in code, tests, documentation, or command arguments.

Validate local paths before upload. Reject absolute paths and traversal paths. Do not follow script symlinks outside the bundle.

## Changes

Make only changes that support the requested work. Do not deploy, publish, push, or change external systems unless the user asks.

Update tests and documentation when behavior changes. Report changed files and validation results.

Project-specific instructions add requirements without weakening shared rules. They do not permit deviation from a convention or validation stage. Keep this file actionable, current, and concise. Keep credentials, secrets, and private machine paths out of it.

Document required files and paths when they apply. The repository structure uses `src/`, `bin/`, `docs/`, and `tests/`.

## Application

The executable entrypoint is `bin/vyops`; it imports `src/main.mjs`. Shutdown closes SSH sessions and active deployment cleanup. Runtime settings come from process environment variables listed in `.env.example`; the app does not load `.env` files. Keep local validation separate from router operations.

Operational boundaries: preflight is local. Backup reads router state. Release changes router state after `--yes` confirms the target summary.

Preflight is read-only and does not modify router state.

## CLI

The default command with no arguments prints usage and exits with an error. Commands are `preflight`, `release`, and `backup`. Options and positional arguments are parsed in `src/args.mjs`; command options can appear before or after the command name. Validate input before SSH setup and report invalid input with a non-zero exit code.

The executable entrypoint is `bin/vyops`, with package target `./bin/vyops`. Release has no dry-run option. Preflight is a read-only local check.

`--help` prints command usage and exits without external effects. `--version` prints the package version and exits. Release requires `--yes`. `--no-hooks` requires `--force`. Preflight makes no SSH connection. Release runs preflight before router operations.

Exit code `0` means success. A non-zero exit code means validation or operation failure. Errors must not expose secrets. Keep output and logs free of credentials.

The CLI targets Node.js 26. Supported platforms are Linux and Windows. Ubuntu CI validates Linux. Windows runs during development; macOS support is inferred from POSIX behavior and is not tested by CI. Validation evidence comes from `npm test` and the CI workflow. Release changes router state only after the user asks for release and confirms with `--yes`. No dry-run option exists. Backup reads router state and writes files to the named destination.

## npm publication

The package is `@eliware/vyops`. `package.json` is the version source. The exact npm files allowlist is `src/`, `docs/`, `README.md`, `AGENTS.md`, `LICENSE`, `RELEASE_NOTES.md`, and `bin/`.

Run `eliware-test --pack` or `npm run pack`. The harness pack stage must pass and check the package manifest. Trusted Publishing uses npm provenance through GitHub OIDC. After release, verify the exact `package.json` version for `@eliware/vyops` at `registry.npmjs.org`.

Eli and the project developer run TagIt preflight together. Eli decides whether the release is ready and instructs DevOps. DevOps executes the authorized release. This section does not grant permission to publish. Publication requires explicit authorization through the Operations release handoff.

Use the repository publication workflow for releases. Do not publish a package unless the user asks.
