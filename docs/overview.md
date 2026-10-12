# Overview

VyOps checks and transfers native VyOS configuration bundles.
It provides preflight, release, and backup commands.

Preflight checks local files. It does not connect to a router.
Release runs preflight, sends the bundle over SSH, and saves confirmed state.
Backup reads the active config and scripts from a router.

Release can update router state. Review the config and target before release.
If Git pushback is enabled, VyOps pushes confirmed router state to the current branch upstream.

This package owns the VyOps CLI, its source, its tests, and its public documentation.
The package does not publish itself or approve router changes.

Read [installation](installation.md), [command use](usage.md), and the workflow guides before use.
