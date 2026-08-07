# AUR package (`tenling-bin`)

Prebuilt Arch package that installs the Linux AppImage from GitHub Releases.

## Layout

```
packaging/aur/tenling-bin/
  PKGBUILD
  .SRCINFO
  tenling.desktop
```

## Release flow

CI rewrites `pkgver` / checksums via `scripts/update-aur-pkgbuild.sh` and can push to:

```text
ssh://aur@aur.archlinux.org/tenling-bin.git
```

Manual first import:

```bash
git clone ssh://aur@aur.archlinux.org/tenling-bin.git
cp packaging/aur/tenling-bin/* tenling-bin/
cd tenling-bin
git add PKGBUILD .SRCINFO tenling.desktop
git commit -m "Initial tenling-bin import"
git push
```

## Install

```bash
yay -S tenling-bin
# or: paru -S tenling-bin
```
