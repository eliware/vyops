# Troubleshooting

## Preflight errors

Check the reported config line for syntax or indentation errors.
Use four spaces for each nested section.
Check the host name and single login user inside the `system` section.
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
Check router tools, available storage, and `/config` write access when remote preflight fails.
Check the `compare` output before VyOS accepts the candidate.
Run `vyops backup` before release when a full router copy is necessary.

Check the latest Git pushback commit when VyOps skips a release.
Use `--force` when it is necessary to run an unchanged release.
Set a branch upstream when pushback fails.
Read the pushback error before you run `git push`.

## Debug logs

Use `--debug` to show command phases, paths, and operation results.
Debug logs do not contain passwords, private keys, or full router config.
Keep logs private because they can contain host names and file paths.
