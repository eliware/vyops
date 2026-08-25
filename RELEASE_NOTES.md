# Release Notes

## 2.1.1

- Fix deployment of `.exe` files in the synchronized `scripts/` tree by
  applying executable permissions (`0755`).
- Treat `.exe` files as binaries during preflight instead of applying
  shell-script shebang and line-ending checks.
- Add regression coverage for executable `.exe` deployment.

## 2.1.0

- **Breaking:** Replace the legacy positional deployment and `--dry-run`
  workflows with the first-class `preflight`, `release`, and `backup`
  commands.
- Add bundle preflight validation for recursively synchronized scripts,
  including CRLF detection, shell shebang validation, and executable intent.
- Derive the release SSH target from the configuration's `system host-name`
  and single `system login user` entry.
- Normalize executable script deployment permissions to `0755` and clean up
  script staging after post-commit synchronization failures.
- Allow command switches such as `--debug` and `--password-stdin` before or
  after the command name.

## 2.0.0

- **Breaking:** Replace the direct `ssh2` integration with the shared
  `@eliware/ssh-client` library for SSH, SFTP, interactive sessions, and
  SSH host-CA verification.
- Update `@eliware/ssh-client` to 2.0.0 and `@eliware/test` to 2.0.0.
- Add cross-platform Windows and Ubuntu CI validation, including package,
  audit, lint, and CLI smoke checks.
- Close SFTP channels after uploads and downloads to prevent SSH channel exhaustion during script synchronization.
- Reconnect after interactive deployments before downloading live configuration and cleaning up remote files.
- Make Git path handling and the `test:gaps` coverage command portable across Windows and Linux.
- Expand Windows and real-VyOS integration coverage to maintain 100% statements, branches, functions, and lines coverage.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm audit --omit=dev --audit-level=moderate`
- `npm run validate:package`
- CLI smoke test on Ubuntu and Windows

## 1.0.11

- Fix VyOS 1.5 `commit-confirm` handling by answering confirmation prompts
  with the full `yes` response.
- Add real disposable-VyOS integration coverage for deployment, backup,
  script synchronization, and invalid configuration handling.
- Allow WAN/VPN latency in opt-in real-router integration tests.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- Real VyOS integration suite (4 tests)
- `npm run lint`
- `npm run audit`

## 1.0.10

- Make Git integration optional for deployments using standalone config files.
- Continue downloading the live VyOS configuration after deployment while
  skipping repository checks and pushback outside a Git repository.
- Add regression coverage for non-Git and unexpected repository paths.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm run audit`

## 1.0.9

- Fix `--password-stdin` to read piped passwords correctly on current Node.js
  runtimes.
- Restore password-authenticated backup workflows for VyOS hosts.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm run audit`

## 1.0.8

- Fail immediately with a redacted VyOS error when confirmed commits reject a
  configuration after the confirmation prompt.
- Prevent malformed PKI and other validation failures from appearing to hang
  at the commit-confirm step.
- Add regression coverage for post-prompt validation errors and structured
  failures without detail text.

Verification:

- `npm test` (100% coverage across statements, branches, functions, and lines)
- `npm run lint`
- `npm run audit`

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
