# Runtime settings

Set runtime values in the process environment.
VyOps does not load `.env` files.
Use `.env.example` as a list of supported names.

| Name                        | Default              | Purpose                                                                                                          |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `VYOPS_SSH_KEY`             | Unset                | Private key path passed to the SSH client. The SSH client uses `~/.ssh/id_rsa` when no key path or agent is set. |
| `SSH_AUTH_SOCK`             | Unset                | SSH agent socket.                                                                                                |
| `SSH_KNOWN_HOSTS`           | `~/.ssh/known_hosts` | Trusted host keys.                                                                                               |
| `SSH_HOST_CA`               | Unset                | Trusted SSH host certificate authority file.                                                                     |
| `VYOPS_CONNECT_TIMEOUT`     | `30000`              | SSH connect timeout in milliseconds.                                                                             |
| `VYOPS_OPERATION_TIMEOUT`   | `60000`              | SSH command and file copy timeout in milliseconds.                                                               |
| `VYOPS_INTERACTIVE_TIMEOUT` | `60000`              | Interactive shell timeout in milliseconds.                                                                       |
| `LOG_LEVEL`                 | `info`               | Shared logger level.                                                                                             |

Timeout values must be positive numbers.
VyOps uses the default when a value is empty, invalid, or not positive.

The logger supports `error`, `warn`, `info`, `http`, `verbose`, `debug`, and `silly`.
Use `--debug` to set the level to `debug` for one command.

Keep host key checks enabled.
Use a trusted `known_hosts` file or a trusted host certificate authority.
Keep private keys and passwords outside Git.
