# Distribution channels for md

Package managers and where each one lives. Prefer the **no-account** paths
first; account-backed channels need secrets listed in the **canonical registry**:

**→ [`.github/SECRETS.md`](../.github/SECRETS.md)** (names, kinds, checklist)

This doc covers *how* each channel works. Secret **names** live only in
`.github/SECRETS.md`.

Release installers always land on
[GitHub Releases](https://github.com/SihanTeng/md/releases) as:

```text
md-{version}-{os}-{arch}.{ext}
```

---

## No account required (configured in this repo)

### 1. Homebrew (macOS)

| | |
| --- | --- |
| Tap repo | [`SihanTeng/homebrew-md`](https://github.com/SihanTeng/homebrew-md) |
| Template | `Casks/md.rb` (this repo) |
| CI | `homebrew` job in `.github/workflows/release.yml` |

**Users:**

```bash
brew tap SihanTeng/md
brew install --cask md
```

**CI secret (optional but recommended):** `DIST_HOMEBREW_TOKEN` — see
[`.github/SECRETS.md`](../.github/SECRETS.md). Without it, the job skips remote
tap publish; the in-repo `Casks/md.rb` is still updated on release so this works:

```bash
brew tap SihanTeng/md https://github.com/SihanTeng/md
brew install --cask md
```

---

### 2. APT (Debian / Ubuntu) — GitHub Pages

| | |
| --- | --- |
| Host | GitHub Pages on this repo (`gh-pages` branch) |
| URL | https://sihanteng.github.io/md/apt/ |
| Source package | `md-{version}-linux-x64.deb` from the release |
| Builder | `scripts/publish-linux-repos.sh` |

**Users:**

```bash
echo "deb [trusted=yes] https://sihanteng.github.io/md/apt ./" | sudo tee /etc/apt/sources.list.d/md.list
sudo apt update
sudo apt install md
```

`[trusted=yes]` is required because the static repo is **not** GPG-signed yet
(signing would need a long-lived key you manage yourself).

---

### 3. DNF (Fedora / RHEL) — GitHub Pages

| | |
| --- | --- |
| Host | Same Pages site under `/rpm/` |
| URL | https://sihanteng.github.io/md/rpm/ |
| Source package | `md-{version}-linux-x64.rpm` |
| Builder | `scripts/publish-linux-repos.sh` + `createrepo_c` |

**Users:**

```bash
sudo tee /etc/yum.repos.d/md.repo <<'EOF'
[md]
name=md
baseurl=https://sihanteng.github.io/md/rpm
enabled=1
gpgcheck=0
EOF
sudo dnf install md
```

No Fedora/COPR account required.

---

### 4. AUR (Arch Linux) — SSH key only

| | |
| --- | --- |
| Package | `md-bin` (prebuilt AppImage) |
| Sources | `packaging/aur/md-bin/` |
| CI | `aur` job — runs only when `DIST_AUR_SSH_KEY` is set |

**One-time setup (you do this in a browser / local machine):**

1. Create an SSH key used only for AUR (do not reuse your GitHub key):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/aur -C "md-aur"
   ```

2. Open **https://aur.archlinux.org** → register / log in →
   **My Account → SSH Public Key** → paste `~/.ssh/aur.pub`.

3. Create the empty AUR package once:

   ```bash
   git clone ssh://aur@aur.archlinux.org/md-bin.git
   # copy packaging/aur/md-bin/* into it, commit, push
   ```

4. Add GitHub secret **`DIST_AUR_SSH_KEY`** = contents of `~/.ssh/aur`
   (private key). See [`.github/SECRETS.md`](../.github/SECRETS.md).

**Users (Arch):**

```bash
yay -S md-bin
# or: paru -S md-bin
```

---

### 5. One-line install scripts

| Platform | Command |
| --- | --- |
| macOS / Linux | `curl -fsSL https://raw.githubusercontent.com/SihanTeng/md/main/install.sh \| bash` |
| Windows | `irm https://raw.githubusercontent.com/SihanTeng/md/main/install.ps1 \| iex` |

Scripts live at the repo root (`install.sh`, `install.ps1`). They resolve the
latest release asset for the host OS (with legacy filename fallbacks).

### 6. Direct download + in-app updates

Always available: GitHub Releases assets + Tauri signed OTA (`latest.json` +
`.sig`). No package manager.

---

## Account-backed (configured — needs your secrets)

### 7. Chocolatey (Windows)

| | |
| --- | --- |
| Package id | `md` |
| Sources | `packaging/chocolatey/md/` |
| CI | `chocolatey` job (windows-latest) |
| Secret | **`DIST_CHOCOLATEY_API_KEY`** ([registry](../.github/SECRETS.md)) |

**One-time setup:**

1. Log in at [chocolatey.org](https://chocolatey.org/account) (you already registered).
2. Open **Account → API Keys** (or https://community.chocolatey.org/account) and
   create a key with push permission for the community repository.
3. In GitHub → `SihanTeng/md` → **Settings → Secrets and variables → Actions**,
   add secret **`DIST_CHOCOLATEY_API_KEY`** = that key.
4. First publish of a brand-new package id may need manual approval on the
   Chocolatey site (moderation). Later versions auto-push via CI.

**Users:**

```powershell
choco install md
```

**Local pack (Windows with choco installed):**

```bash
./scripts/publish-chocolatey.sh 0.2.0 path/to/md-0.2.0-windows-x64.msi --pack-only
```

---

### 8. Fedora COPR

| | |
| --- | --- |
| Spec | `packaging/copr/md.spec` (AppImage → `/usr/bin/md`) |
| CI | `copr` job |
| Secret / variable | **`DIST_COPR_CONFIG`**, **`DIST_COPR_PROJECT`** ([registry](../.github/SECRETS.md)) |

**One-time setup:**

1. Log in at [copr.fedorainfracloud.org](https://copr.fedorainfracloud.org).
2. Create a project (e.g. name `md`) for the chroots you care about
   (at least `fedora-rawhide-x86_64` and current Fedora x86_64).
3. Open **https://copr.fedorainfracloud.org/api/** → copy the full
   `[copr-cli]` config block.
4. GitHub:
   - Secret **`DIST_COPR_CONFIG`** — entire config file contents
   - Variable **`DIST_COPR_PROJECT`** — e.g. `YourFedoraUsername/md`

Tokens expire about every **180 days** — regenerate at the API page and update
`DIST_COPR_CONFIG` when builds start failing auth.

**Users:**

```bash
sudo dnf copr enable YourFedoraUsername/md
sudo dnf install md
```

**Local SRPM only:**

```bash
./scripts/publish-copr.sh 0.2.0 path/to/md-0.2.0-linux-x64.AppImage --srpm-only
```

---

## Still optional (not wired)

| Channel | Register |
| --- | --- |
| **packagecloud** | https://packagecloud.io/users/sign_up |
| **Winget** | PR to https://github.com/microsoft/winget-pkgs |
| **Flathub** | https://docs.flathub.org/docs/for-app-authors/submission |
| **Microsoft Store** | https://partner.microsoft.com/dashboard |

---

## Secrets checklist

**Canonical list:** [`.github/SECRETS.md`](../.github/SECRETS.md)

Do not invent new secret names here — update the registry first, then the workflow.

---

## Local helpers

```bash
# Rewrite Homebrew cask version + sha256
./scripts/update-homebrew-cask.sh 0.2.0 <dmg-sha256>

# Rewrite AUR PKGBUILD + .SRCINFO
./scripts/update-aur-pkgbuild.sh 0.2.0 path/to/md-0.2.0-linux-x64.AppImage

# Build static APT + RPM trees (for Pages)
./scripts/publish-linux-repos.sh 0.2.0 path/to/assets ./dist-repos

# Chocolatey: rewrite + pack (+ push if DIST_CHOCOLATEY_API_KEY set)
./scripts/publish-chocolatey.sh 0.2.0 path/to/md-0.2.0-windows-x64.msi

# COPR: rewrite + SRPM (+ submit if DIST_COPR_CONFIG + DIST_COPR_PROJECT set)
./scripts/publish-copr.sh 0.2.0 path/to/md-0.2.0-linux-x64.AppImage
```


