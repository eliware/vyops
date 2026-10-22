# Runtime settings

Set runtime values in the process environment.
VyOps does not load `.env` files.
The package includes [`.env.example`](../.env.example) with optional settings and placeholder values.

| Name                        | Default              | Required status | Placeholder                     | Purpose                                                                                                           |
| --------------------------- | -------------------- | --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VYOPS_SSH_KEY`             | Unset                | Optional        | `~/.ssh/id_rsa`                 | Private key path passed to the SSH client. The SSH client uses this default key path when no key or agent is set. |
| `SSH_AUTH_SOCK`             | Unset                | Optional        | `/run/user/1000/ssh-agent.sock` | SSH agent socket path.                                                                                            |
| `SSH_KNOWN_HOSTS`           | `~/.ssh/known_hosts` | Optional        | `~/.ssh/known_hosts`            | Trusted host keys.                                                                                                |
| `SSH_HOST_CA`               | Unset                | Optional        | `/path/to/host_ca.pub`          | Trusted SSH host certificate authority file.                                                                      |
| `VYOPS_CONNECT_TIMEOUT`     | `30000`              | Optional        | `30000`                         | SSH connect timeout in milliseconds.                                                                              |
| `VYOPS_OPERATION_TIMEOUT`   | `60000`              | Optional        | `60000`                         | SSH command and file copy timeout in milliseconds.                                                                |
| `VYOPS_INTERACTIVE_TIMEOUT` | `60000`              | Optional        | `60000`                         | Interactive shell timeout in milliseconds.                                                                        |
| `LOG_LEVEL`                 | `info`               | Optional        | `info`                          | Shared logger level.                                                                                              |

Timeout values must be positive numbers.
VyOps uses the default when a value is empty, invalid, or not positive.

The logger supports `error`, `warn`, `info`, `http`, `verbose`, `debug`, and `silly`.
Use `--debug` to set the level to `debug` for one command.

Keep host key checks enabled.
Use a trusted `known_hosts` file or a trusted host certificate authority.
Keep private keys and passwords outside Git.
