# Release

Release sends a local bundle to the router in its config.
Release changes router state.
Check the target and bundle before you start.

## Start a release

Run preflight first:

```sh
vyops preflight config.boot
```

Release the checked bundle:

```sh
vyops release --yes config.boot
```

Show safe debug messages:

```sh
vyops release --yes --debug config.boot
```

`--yes` is required.
The release summary shows the target, config path, script count, and selected options.

## Release steps

VyOps runs local preflight before Git checks or SSH setup.
It checks router tools, the writable config folder, and available storage.
It copies the config and prepares scripts in temporary router paths.
It loads the config in an interactive VyOS shell and displays `compare` output.

It runs `commit-confirm 5` and confirms the candidate.
It saves the accepted config.
It downloads the active config and deployment manifest.
It runs synced post-commit scripts.

The script sync removes temporary files.

If you do not confirm the candidate in five minutes, VyOS restores the prior config.
VyOps reports an error when a load, commit, confirmation, or save step fails.
VyOps reconnects when it must restore scripts or complete cleanup.

## Release options

Use `--force` to run when the latest commit is a VyOps pushback and bundle files have no changes.
Use `--verify` to check VRRP, WireGuard, BGP, routes, and HAProxy after release.
Use `--verify-binaries` to compare SHA-256 hashes for binary scripts after upload.
Use `--no-pushback` to keep confirmed router state out of Git.
Use `--no-hooks --force` to skip script sync.

`--no-pushback` can make router state and Git inconsistent.
`--no-hooks` can keep router scripts and the bundle out of sync.
VyOps does not provide a release dry run.

## Git pushback

When the config is in a Git repository, VyOps pushes confirmed state unless you set `--no-pushback`.
It adds `config.boot`, `config.boot.manifest.tsv`, and `config.boot.deployment.tsv` to a `Pushback` commit.
It pushes that commit to the current branch upstream.
Set an upstream before release when pushback is required.
VyOps refuses pushback when the repository changes during release.

The bundle manifest lists managed script paths.
The deployment manifest records prior and installed file state for the router.
Keep these files in separate paths.
VyOps can read an older manifest that stores prior and installed state in two compatible rows.
After script sync, VyOps writes one row for each path.

## Script checks

VyOps lists live scripts before script sync.
It preserves router-only files.
It saves matching files for restoration.
Run `vyops backup` before release to save the full router state.

## Security

Keep router config, debug output, and backups private.
VyOps does not write full router config or passwords to output.
Verify the SSH host and use a router account with restricted access.
Run releases on one router at a time.
Request approval before each release outside a lab.
