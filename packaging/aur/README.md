# AUR package (`md-bin`)

Prebuilt Arch package that installs the Linux AppImage from GitHub Releases.

## Secrets

Canonical name: **`DIST_AUR_SSH_KEY`**

See [`.github/SECRETS.md`](../../.github/SECRETS.md).

## One-time setup (SSH key only)

1. Generate a dedicated key:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/aur -C "md-aur"
   ```

2. Register the **public** key at  
   **https://aur.archlinux.org** → log in / create account →  
   **My Account → SSH Public Key**.

3. Create the remote package once:

   ```bash
   git clone ssh://aur@aur.archlinux.org/md-bin.git
   cp packaging/aur/md-bin/* md-bin/
   cd md-bin
   git add PKGBUILD .SRCINFO md.desktop
   git commit -m "Initial md-bin import"
   git push
   ```

4. Add GitHub Actions secret **`DIST_AUR_SSH_KEY`** = contents of `~/.ssh/aur`
   (private key). The Release workflow will update and push on each tag.

Until step 4 is done, the `aur` job is a no-op notice.

## Users

```bash
yay -S md-bin
```
