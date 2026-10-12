# AGENTS.md

## Project

This repository contains the VyOps CLI.

## Scope and boundaries

Use README.md for repository purpose, ownership, scope, and boundaries.
Get Eliware Operations approval before an external change.

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

Keep changes within this repository scope.

## Application

Document workflows, entrypoints, settings, startup, and shutdown in README.md.

## CLI

Document commands, options, arguments, defaults, errors, and exit codes in README.md.

## npm publication

Include specs/ in the package.
Document install, entrypoints, contents, and release limits in README.md.
