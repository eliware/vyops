# Release Notes

## 1.0.7

- Add password-based SSH bootstrap through the secure `--password-stdin` mode.
- Preserve strict `known_hosts` verification when using password authentication.
- Handle VyOS return-only pager prompts and disable paging before deployment compares.
- Add packaged CLI, password-authentication, backup failure, and deployment regression tests.
- Add opt-in real-VyOS integration test scaffolding for dry-run and backup workflows.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm run audit`
- `npm run validate:package`

## 1.0.6

- Add `--backup` to download the active `config.boot` and complete
  `/config/scripts` tree into a local backup directory.
- Fail promptly on VyOS load and commit errors instead of waiting indefinitely
  for confirmation prompts.
- Preserve synchronized scripts when post-commit local config download fails.
- Include staged configuration changes in Git pushback detection.
- Expand CLI, deployment, backup, Git, and SSH regression coverage.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm run audit`
- `npm run validate:package`

## 1.0.5

- Create nested temporary directories before uploading synchronized scripts.
- Fix deployment of nested files such as systemd units and boot scripts.

Verification:

- `npm test`
- `npm run lint`
- `npm run audit`
- `npm run validate:package`

## 1.0.4

- Synchronize the complete repository `scripts/` tree to `/config/scripts`.
- Preserve script file modes and transactionally back up and roll back all
  synchronized paths.
- Add recursive synchronization coverage for nested script directories.

Verification:

- `npm test`
- `npm run lint`
- `npm run audit`
- `npm run validate:package`

## 1.0.2

- Hardened SSH host verification with the user's `known_hosts` file.
- Added validated targets, SSH/SFTP timeouts, randomized remote temporary paths, and awaited cleanup.
- Added transactional post-commit hook backup and rollback.
- Added Git pushback isolation, locking, stale-lock recovery, and `--force`.
- Added `--debug` logging and improved interactive deployment validation.
- Added npm packaging whitelist and package validation.
- Added CI timeout, dependency audit, and package validation.

Verification:

- `npm test` (100% coverage)
- `npm run lint`
- `npm run audit`
- `npm run validate:package`

## 1.0.3 - 2026-08-10

- Expanded README documentation for installation, configuration, usage, security, operations, development, and support.
- Documented Git pushback behavior and dry-run validation.
- Added `@eliware/common` logging, filesystem, path, error-handler, and signal-handler integration.

Verification:

- `npm test`
- `npm run lint`
