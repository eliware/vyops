# Troubleshooting

## Preflight errors

Check the reported config line for syntax or indentation errors.
Use four spaces for each nested block.
Check the host name and single login user inside the `system` block.
Check script paths and the manifest header.
Use tabs between manifest fields.

## SSH errors

Check the target name, network path, credentials, and trusted host key.
Check `SSH_KNOWN_HOSTS` or `SSH_HOST_CA` when host validation fails.
Check `VYOPS_SSH_KEY` or `SSH_AUTH_SOCK` when key access fails.
Use `--password-stdin` for password access.

## Timeout errors

Set a positive timeout value in milliseconds.
Use `VYOPS_CONNECT_TIMEOUT` for connection setup.
Use `VYOPS_OPERATION_TIMEOUT` for SSH commands and file transfers.
Use `VYOPS_INTERACTIVE_TIMEOUT` for interactive VyOS commands.

## Release errors

Run preflight to find local errors before SSH setup.
Check router tools, free space, and `/config` write access when remote preflight fails.
Review the `compare` output before VyOS accepts the candidate.
Run `vyops backup` before release when you need a full router backup.

Check the latest Git pushback commit when VyOps skips a release.
Use `--force` when you need to run an unchanged release.
Set a branch upstream when pushback fails.
Review the pushback error before you run `git push` yourself.

## Debug logs

Use `--debug` to show command phases, paths, and operation results.
Debug logs do not contain passwords, private keys, or full router config.
Keep logs private because they can contain host names and file paths.
