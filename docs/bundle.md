# Bundle format

## Files

Put the config and script folder in one bundle directory:

```text
bundle/
  config.boot
  config.boot.manifest.tsv
  scripts/
```

Keep `config.boot.manifest.tsv` when VyOps has managed router scripts.
The manifest is optional for a new bundle.
Store the bundle in Git when you want release pushback.

## Config rules

- Write native VyOS config text as UTF-8.
- Use four spaces for each nested section.
- Put each opening curly bracket at the end of its line.
- Put each closing curly bracket alone on its line.
- Use one config statement on each line.
- Use single or double quotation marks around values when necessary.
- Start comments with `#` outside quoted values.

Put one `host-name` inside the `system` section.
Put exactly one user inside `system login`.
VyOps forms the release target as `user@host-name`.

## Script rules

Put regular script files under `scripts/`.
Use nested folders and forward slashes in manifest paths.
Use letters, digits, period, underscore, at sign, slash, or hyphen in each path.
Do not use an absolute path or a `.` or `..` path segment.
Use LF line endings for text scripts.

VyOps checks executable text files for a supported shebang.
Use `/bin/sh`, `/bin/bash`, `/bin/vbash`, or `/usr/bin/env` as the interpreter.
VyOps treats `.exe` files as binaries.
VyOps does not follow directory symlinks when it scans the local script tree.

## Script manifest

Use a tab between each field.
Use this header and one `file` row for each managed path:

```text
kind	path
file	commit/post-hooks.d/example
```

You can add a `preexisting` column to the header and one field to each row.
Do not add directory rows, duplicate paths, unsafe paths, or more fields.
VyOps keeps this bundle manifest separate from `config.boot.deployment.tsv`.
