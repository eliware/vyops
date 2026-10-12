# Release

Release sends a local bundle to the router in its config.
Release changes router state.
Review the target and bundle before you start.

## Start a release

Run preflight first:

```sh
vyops preflight config.boot
```

Release the checked bundle:

```sh
vyops release --yes config.boot
```

Show safe detail logs:

```sh
vyops release --yes --debug config.boot
```

`--yes` is required.
The release summary shows the target, config path, script count, and selected options.

## Release steps

VyOps runs local preflight before Git checks or SSH setup.
It checks router tools, the writable config folder, and free disk space.
It uploads the config and stages scripts in temporary router paths.
It loads the config in an interactive VyOS shell and shows `compare` output.
It runs `commit-confirm 5` and confirms the candidate.
It saves the accepted config.
It downloads the active config and deployment manifest.
It runs synchronized hooks, then removes temporary files.

VyOS rolls back an unconfirmed candidate after five minutes.
VyOps reports an error when a load, commit, confirmation, or save step fails.
VyOps reconnects when it must restore scripts or finish cleanup.

## Release options

Use `--force` to run when the latest commit is a VyOps pushback and bundle files have no changes.
Use `--verify` to check VRRP, WireGuard, BGP, routes, and HAProxy after release.
Use `--verify-binaries` to compare SHA-256 hashes for binary scripts after upload.
Use `--no-pushback` to keep confirmed router state out of Git.
Use `--no-hooks --force` to skip script sync.

`--no-pushback` can leave router state and Git out of sync.
`--no-hooks` can leave router scripts and the bundle out of sync.
VyOps does not provide a release dry run.

## Git pushback

When the config sits in a Git repository, VyOps pushes confirmed state unless you set `--no-pushback`.
It adds `config.boot`, `config.boot.manifest.tsv`, and `config.boot.deployment.tsv` to a `Pushback` commit.
It pushes that commit to the current branch upstream.
Set an upstream before release when you need pushback.
VyOps refuses pushback when the repo changes during release.

The bundle manifest tracks managed script paths.
The deployment manifest records old and new file state for the router.
Keep these files separate.

## Script review

VyOps reports live scripts before script sync.
It keeps router-only files unchanged.
It saves matching files for rollback.
Run `vyops backup` before a release for a full router backup.

## Security

Keep router config, debug logs, and backups private.
VyOps does not log full router config or passwords.
Use SSH host verification and a least-privilege router account.
Do not run releases on two routers at the same time.
Get approval before any release outside a lab.
