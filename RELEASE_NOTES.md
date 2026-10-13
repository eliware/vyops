# Release Notes

## 12.0.0 — 2026-10-12

### Breaking changes

- Require Node.js 26 or later.
- Remove legacy deploy and dry-run commands.
- Require `--yes` before release.
- Get the release target from the VyOS config.

### Added

- Add full user guides for install, commands, bundles, settings, release, backup, and errors.
- Add modular behavior specifications and package checks.
- Add safe debug details to preflight, release, and backup.
- Add backup manifests for the active config and script paths.
- Add host certificate checks and SSH key setup through standard input.
- Add Ubuntu CI and publish workflows and the Knit release workflow.
- Add opt-in tests for disposable VyOS routers.

### Changed

- Run preflight before Git checks and SSH setup during release.
- Use the shared SSH client API for router connections.
- Keep bundle and router deployment manifests in separate files.
- Push confirmed config and manifest changes to Git after release.
- Skip an unchanged pushback release unless the user sets `--force`.
- Align package metadata, workflows, and tests with Eliware Test 12.
- Validate nested script bundles and sync the complete `scripts/` tree.
- Use `commit-confirm`, show `compare`, and save only after confirmation.
- Replace deploy, CLI, validation, backup, and SSH modules with focused modules.
- Split tests by workflow and mock Git and SSH commands.
- Use the standard package, documentation, and repository metadata.
- Run CI on Ubuntu only. Windows support remains unverified.

### Fixed

- Accept `@` in safe script paths.
- Reject malformed, duplicate, and unsafe script manifest paths.
- Reject unsafe live script paths and recheck remote script links before backup.
- Parse config blocks and deployment manifest headers correctly.
- Preserve prior backup files when backup publication fails.
- Restore script files after a failed release and remove temporary router files.
- Preserve manifest updates during Git pushback.
- Protect Git pushback locks during live verification.
- Preserve successful releases when cleanup fails.
- Retry failed hook finalization and report remote cleanup failures.
- Handle router prompts with trailing spaces.
- Handle backup staging, remote scans, and snapshot cleanup failures.
- Close SSH sessions after success and failure.
- Hide raw interactive router output from debug logs.

## 2.1.1 — 2026-08-25

### Fixed

- Apply executable permissions to `.exe` files in the synchronized `scripts/` tree.
- Check `.exe` files as binaries during preflight.

## 2.1.0 — 2026-08-24

### Breaking changes

- Replace legacy deploy and dry-run modes with `preflight`, `release`, and `backup` commands.

### Added

- Validate nested script bundles before release.
- Get the router target from VyOS system config.
- Support global command switches before or after the command name.

### Changed

- Set executable script permissions and clean staged scripts after errors.

## 2.0.0 — 2026-08-24

### Breaking changes

- Replace direct SSH code with the shared SSH client.

### Added

- Add host certificate checks, hook backup, Git pushback, and debug logs.
- Add Windows and Ubuntu CI checks.

### Fixed

- Close SFTP channels after file transfer.
- Reconnect after interactive release before download and cleanup.

## 1.0.11 — 2026-08-21

### Fixed

- Send the full `yes` response to confirm VyOS 1.5 commits.

### Added

- Add opt-in tests for disposable VyOS routers.

## 1.0.10 — 2026-08-21

### Fixed

- Allow release without Git and skip pushback outside a Git repository.

## 1.0.9 — 2026-08-21

### Fixed

- Read piped passwords in current Node.js versions.

### Added

- Restore password-based SSH bootstrap.

## 1.0.8 — 2026-08-20

### Fixed

- Report commit errors without waiting for a timeout.

## 1.0.7 — 2026-08-20

### Added

- Add password-based SSH bootstrap with strict host checks.
- Add CLI, backup, and release regression tests.

## 1.0.6 — 2026-08-20

### Added

- Back up the active config and complete scripts tree.
- Handle config load and commit errors.

### Fixed

- Keep synchronized scripts when config download fails.
- Include staged changes in Git pushback checks.

## 1.0.5 — 2026-08-13

### Fixed

- Create nested temporary folders before script upload.

## 1.0.4 — 2026-08-13

### Added

- Sync nested script files and keep file modes.
- Back up and restore script paths as one transaction.

## 1.0.3 — 2026-08-10

### Added

- Add install, config, usage, security, and operations guidance.
- Add shared logging, file, path, error, and signal tools.

## 1.0.2 — 2026-08-10

### Added

- Add SSH host checks, timeouts, remote cleanup, hook backup, and Git pushback.
- Add package file rules and CI validation.
