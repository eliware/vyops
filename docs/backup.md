# Backup

Backup reads the active config and scripts from a router.
It does not change router config.
It uses temporary remote snapshots while it reads script files.

Save router data:

```sh
vyops backup vyos@router /path/to/backup
```

Use password input when the router needs a password:

```sh
vyops backup --password-stdin vyos@router /path/to/backup
```

The target format is `user@host`.
Use a DNS name, an IPv4 address, or a bracketed IPv6 address.
Do not use a filesystem root as the destination.

The backup has `config.boot`, `config.boot.manifest.tsv`, and `scripts/`.
The manifest lists backed-up script paths with tab-separated fields.
VyOps sets backup file mode to `0600`.

VyOps checks remote script paths and rejects remote script symlinks.
It writes new files to a private temporary folder.
It replaces the config, scripts, and manifest as one update.
It restores prior files if publication fails.
It closes the SSH connection after success or failure.

Keep backups private.
They can contain router config and private key files.
