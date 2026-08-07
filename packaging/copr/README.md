# Fedora COPR package

Repackages the official Linux AppImage as an RPM via COPR.

## Layout

```
packaging/copr/
  tenling.spec
  tenling.desktop
  README.md
```

## Build SRPM / submit

```bash
./scripts/publish-copr.sh 0.3.0 ./tenling-0.3.0-linux-x64.AppImage --srpm-only
# or submit to COPR (needs DIST_COPR_CONFIG + DIST_COPR_PROJECT):
./scripts/publish-copr.sh 0.3.0 ./tenling-0.3.0-linux-x64.AppImage
```

Project path example: `YourFedoraUser/tenling`.
