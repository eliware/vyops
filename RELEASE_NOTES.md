# Release Notes

## 15.0.1 — 2026-10-27

### Changed

- Upgrade `@eliware/common`, `@eliware/ssh-client`, and `@eliware/test` to version 15.0.1.
- Move CLI lifecycle setup and cleanup to a focused entrypoint module.
- Move remote script directory inspection to a focused module.
- Move deployment manifest record validation to a focused module.
- Define command and positional value order in the CLI specification.
- Include `.env.example` in the package content specification.
- Clarify that npm publication and router releases use separate workflows.

### Fixed

- Redact secret values from SSH command debug summaries.
- Remove repeated optional-service status checks from release integration tests.

## 15.0.0 — 2026-10-22

### Added

- Include `.env.example` in the published package.
- Upgrade `@eliware/common`, `@eliware/ssh-client`, and `@eliware/test` to version 15.0.0.
- Align CI, npm publication, and Knit workflows with the approved shared workflows.
- Use full Git history in CI for tag and release checks.
- Add mocked tests with an in-memory file system and maintain 100 percent source coverage.
- Add focused modules and matching tests for CLI arguments, backups, bundles, config, deployment, Git, SSH, and validation.

### Changed

- Rewrite user docs, specifications, README, and AGENTS instructions in ASD-STE100 language.
- Split command parsing, config parsing, bundle scanning, SSH, backup, deployment, and Git work into focused modules.
- Separate script staging, installation, manifest updates, rollback, and cleanup into focused helpers.
- Sort configuration values and script paths in natural order.
- Run local preflight before Git checks or SSH setup for every release.
- Build the router deployment manifest from the backed-up script paths and their current file state.
- Keep the bundle manifest separate from the router deployment manifest.
- Publish the config and both manifests as one local backup update.
- Validate deployment manifest columns, record types, script paths, and duplicate paths before remote updates.

### Fixed

- Write current deployment state for backed-up directories and scripts, and verify downloaded files against router hashes.
- Store prior and current type, mode, and hash for each backed-up script file and directory.
- Reject a command after a leading `--` and reject more positional values after the delimiter.
- Validate deployment manifest headers, records, paths, and duplicates before remote updates.
- Write actual tab characters in the remote deployment manifest header.
- Commit selected untracked deployment files during Git pushback.
- Run remote interruption cleanup if an SSH client close fails.
- Reject symbolic-link snapshot folders during cleanup.
- Keep files outside the snapshot unchanged.
- Mark interactive shell commands settled after success or failure.
- Test configured SSH known-host and host CA paths through the SSH fixture.
- Accept standard trailing file descriptions when VyOps checks a remote binary's architecture.
- Reject AArch64 binaries on ARMv7 routers.

## 12.0.0 — 2026-10-12

### Breaking changes

- Require Node.js 26 or later.
- Remove legacy deploy and dry-run commands.
- Require `--yes` before release.
- Read the release target from the VyOS config.

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
- Reject unsafe live script paths and check remote script links before backup.
- Parse config blocks and deployment manifest headers correctly.
- Preserve prior backup files when backup publication fails.
- Restore script files after a failed release and remove temporary router files.
- Preserve manifest updates during Git pushback.
- Prevent Git pushback locks from expiring during live verification.
- Preserve completed releases when cleanup fails.
- Retry failed script finalization and report remote cleanup failures.
- Process router prompts with trailing spaces.
- Report backup staging, remote scans, and snapshot cleanup failures.
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
- Read the router target from VyOS system config.
- Support global command switches before or after the command name.

### Changed

- Set executable script permissions and clean staged scripts after errors.

## 2.0.0 — 2026-08-24

### Breaking changes

- Replace direct SSH code with the shared SSH client.

### Added

- Add host certificate checks, post-commit script backup, Git pushback, and debug output.
- Add Windows and Ubuntu CI checks.

### Fixed

- Close SFTP channels after file copy.
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

- Save the active config and complete scripts tree.
- Report config load and commit errors.

### Fixed

- Keep synchronized scripts when config download fails.
- Include staged changes in Git pushback checks.

## 1.0.5 — 2026-08-13

### Fixed

- Create nested temporary folders before script upload.

## 1.0.4 — 2026-08-13

### Added

- Sync nested script files and keep file modes.
- Save and restore script paths as one transaction.
