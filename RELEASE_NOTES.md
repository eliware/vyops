# Release Notes

## 11.0.0 — 2026-10-07

### Changed

- Run local bundle and manifest checks before release operations.
- Allow `@` in safe relative script paths.
- Align the package with Eliware repository conventions.

## 2.1.1 — 2026-08-25

### Fixed

- Apply executable permissions to `.exe` files in the synchronized `scripts/` tree.
- Check `.exe` files as binaries during preflight.

## 2.1.0 — 2026-08-24

### Breaking changes

- Replace legacy deploy and dry-run modes with `preflight`, `release`, and `backup` commands.

### Added

- Validate nested script bundles before release.
- Derive the router target from VyOS system configuration.
- Support global command switches before or after the command name.

### Changed

- Normalize executable script permissions and clean staged scripts after errors.

## 2.0.0 — 2026-08-24

### Breaking changes

- Replace direct SSH integration with the shared SSH client.

### Added

- Add host certificate checks, transactional hook backup, Git pushback isolation, and debug logging.
- Add Windows and Ubuntu CI checks.

### Fixed

- Close SFTP channels after file transfer.
- Reconnect after interactive deployment before downloads and cleanup.

## 1.0.11 — 2026-08-21

### Fixed

- Confirm VyOS 1.5 commits with the full `yes` response.

### Added

- Add opt-in integration tests for disposable VyOS routers.

## 1.0.10 — 2026-08-21

### Fixed

- Allow deploy without Git and skip pushback outside a Git working tree.

## 1.0.9 — 2026-08-21

### Fixed

- Read piped passwords in current Node.js versions.

### Added

- Restore password-based SSH bootstrap.

## 1.0.8 — 2026-08-20

### Fixed

- Report commit validation errors without waiting for a timeout.

## 1.0.7 — 2026-08-20

### Added

- Add password-based SSH bootstrap with strict host verification.
- Add CLI, backup, and deployment regression tests.

## 1.0.6 — 2026-08-20

### Added

- Add backup of the active config and complete scripts tree.
- Add handling for load and commit errors.

### Fixed

- Preserve synchronized scripts when config download fails.
- Include staged changes in Git pushback checks.

## 1.0.5 — 2026-08-13

### Fixed

- Create nested temporary directories before script upload.

## 1.0.4 — 2026-08-13

### Added

- Synchronize nested script files and preserve file modes.
- Back up and roll back synchronized paths as one transaction.

## 1.0.3 — 2026-08-10

### Added

- Add installation, configuration, usage, security, and operations guidance.
- Add shared logging, filesystem, path, error, and signal utilities.

## 1.0.2 — 2026-08-10

### Added

- Add SSH host checks, timeouts, remote cleanup, transactional hooks, and Git pushback.
- Add package allowlist and CI validation.
