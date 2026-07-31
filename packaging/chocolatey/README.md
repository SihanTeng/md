# Chocolatey package (`md`)

Installs the official Windows MSI from GitHub Releases.

## Layout

```text
md/
  md.nuspec
  tools/
    chocolateyInstall.ps1
    chocolateyUninstall.ps1
    VERIFICATION.txt
    LICENSE.txt
```

## Secret

`DIST_CHOCOLATEY_API_KEY` — see [`.github/SECRETS.md`](../../.github/SECRETS.md).

## Local

```bash
./scripts/publish-chocolatey.sh 0.2.0 ./md-0.2.0-windows-x64.msi --pack-only

export DIST_CHOCOLATEY_API_KEY=...
./scripts/publish-chocolatey.sh 0.2.0 ./md-0.2.0-windows-x64.msi
```
