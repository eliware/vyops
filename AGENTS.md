# AGENTS.md

## Project

This repository contains the VyOps CLI.

## Scope and boundaries

Use README.md for repository purpose, ownership, scope, and boundaries.
Request Eliware Operations approval before each external change.

## Layout

Use README.md and specs/README.md to find repository files.

## Development

Use Node.js 26 or later.
Use native ESM for maintained JavaScript modules.

## Validation

Run `npm test` for aggregate validation.
Run `npm run lint` for lint checks.
Run `npm run audit` for dependency checks.
Run `npm run format` to format files.
Run `npm run format:check` to check formatting.

## Security

Keep credentials, private data, router data, and runtime state out of Git.

## Changes

Keep all changes in this repository.

## Application

Document workflows, entrypoints, settings, startup, and shutdown in README.md.
Run focused tests first during development.
Run one test file with `npm test -- tests/path/to/example.test.mjs`.
Run multiple test files with `npm test -- tests/path/to/first.test.mjs tests/path/to/second.test.mjs`.
Prevent repeated full-suite runs during development.
Run the full `npm test` suite for final validation before a commit, milestone, or release.

## CLI

Document commands, options, arguments, defaults, errors, and exit codes in README.md.

## npm publication

Include specs/ in the package.
Document install, entrypoints, contents, and release limits in README.md.
