# Fedora COPR package (`md`)

Repackages the official Linux AppImage as an RPM via COPR.

## Layout

```text
copr/
  md.spec
  md.desktop
```

## Secret / variable

| Name | Kind |
| --- | --- |
| `DIST_COPR_CONFIG` | Secret |
| `DIST_COPR_PROJECT` | Variable |

See [`.github/SECRETS.md`](../../.github/SECRETS.md).

## Local

```bash
./scripts/publish-copr.sh 0.2.0 ./md-0.2.0-linux-x64.AppImage --srpm-only

export DIST_COPR_CONFIG="$(cat ~/.config/copr)"
export DIST_COPR_PROJECT=YourFedoraUsername/md
./scripts/publish-copr.sh 0.2.0 ./md-0.2.0-linux-x64.AppImage
```

## Users

```bash
sudo dnf copr enable YourFedoraUsername/md
sudo dnf install md
```
