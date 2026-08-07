# Chocolatey package (`tenling`)

Installs the official Windows MSI from GitHub Releases.

## Layout

```
packaging/chocolatey/tenling/
  tenling.nuspec
  tools/
    chocolateyInstall.ps1
    chocolateyUninstall.ps1
    VERIFICATION.txt
    LICENSE.txt
```

## Release

`scripts/update-chocolatey-package.sh` rewrites version + MSI checksum;  
`scripts/publish-chocolatey.sh` packs and pushes (needs `DIST_CHOCOLATEY_API_KEY`).

```bash
choco install tenling
```
