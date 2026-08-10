# Release Notes

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

## Unreleased

- Expanded README documentation for installation, configuration, usage, security, operations, development, and support.
- Documented Git pushback behavior and dry-run validation.
- Added `@eliware/common` logging, filesystem, path, error-handler, and signal-handler integration.

Verification:

- `npm test`
- `npm run lint`
