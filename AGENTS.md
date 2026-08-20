# AGENTS.md

## Purpose

VyOps deploys native VyOS configuration files over SSH.

## Layout

- `vyops.mjs`: executable entry point only
- `src/args.mjs`: CLI argument validation
- `src/ssh.mjs`: SSH, SFTP, and interactive shell operations
- `src/deploy.mjs`: deployment workflow
- `src/main.mjs`: application entry logic
- `tests/`: Jest tests

## Development

Use Node.js ESM. Keep modules small and single-purpose.

Run validation before reporting changes:

```sh
npm test
npm run lint
```

Do not deploy to a router during tests unless explicitly requested.

## Deployment behavior

The target must be supplied as `user@host` and use existing SSH keys. The config must be native VyOS curly-brace format. Deployments must show `compare`, use confirmed commit behavior, save only after confirmation, exit both configuration and shell sessions, and clean up temporary remote files.

Never deploy core1 and core2 concurrently.
- Do not over-engineer simple tasks.
- Do not guess when confused.
- Do not make random, pointless changes.
- Check your own work before saying you're done.
