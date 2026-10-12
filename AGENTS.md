# AGENTS.md

## Project

This repository is `eliware/vyops`.

It checks and transfers VyOS configuration bundles.

## Scope and boundaries

Use README.md for repository purpose, scope, and ownership.

## Layout

Use README.md and specs/README.md to find repository files.

## Development

Keep each source and test module focused on one responsibility.

## Validation

Use Node.js 26 or later and npm 12 or later.
Use native ESM for maintained JavaScript modules.
Run `npm test` for aggregate validation.
Run `npm run lint` for lint checks.
Run `npm run audit` for dependency checks.
Run `npm run format` to format files.
Run `npm run format:check` to check formatting.

## Security

Keep credentials, secret values, private data, and runtime state out of Git.

## Changes

Keep changes within this repository scope.
Use Eliware Operations for approval before external changes.

## Application

Document entrypoints, workflows, settings, startup, and shutdown in README.md.

## CLI

Document commands, options, arguments, defaults, errors, and exit codes in README.md.

## npm publication

Include specs/ in the package.
Document install, entrypoints, contents, and release limits in README.md.
