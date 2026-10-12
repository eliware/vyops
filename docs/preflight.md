# Preflight

Preflight checks a local bundle before a release.
It makes no SSH connection and does not change local files.

Run preflight:

```sh
vyops preflight config.boot
```

Show safe detail logs:

```sh
vyops preflight --debug config.boot
```

Preflight reads and checks the config syntax.
It gets the target from the `system host-name` and the only `system login user`.
It scans regular files under `scripts/`.
It checks script paths, text line endings, executable modes, and shebangs.
It checks `config.boot.manifest.tsv` when that file exists.

Preflight reports the target and script count after all checks pass.
It returns an error when a check fails.
Release runs preflight before Git checks or SSH setup.
