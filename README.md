# md

`md` is a desktop Markdown viewer and editor for macOS, Linux, and Windows. It keeps documents as portable `.md` files while offering visual editing, native file controls, and a presentation mode built from your headings.

## What makes md different

`md` combines a focused document editor with tools for navigating and presenting the same file:

- **Visual Markdown editing**: format headings, lists, tasks, links, quotes, and code without editing Markdown syntax
- **Presentation mode**: turn level-one and level-two headings into slides without maintaining a separate deck
- **Native file workflow**: open, save, save as, and reopen recent documents through desktop menus and shortcuts
- **Document navigation**: jump between sections from an outline generated from the current document
- **System-aware appearance**: follow the system theme or select light or dark mode
- **Compact desktop packaging**: use the operating system’s web view instead of bundling a browser engine

## Install md

Download the package for your operating system from the [latest md release](https://github.com/SihanTeng/md/releases/latest).

### Install on macOS

With [Homebrew](https://brew.sh):

```bash
brew install --cask sihanteng/md/md
```

Or download the universal `.dmg`, open it, and drag **md** into **Applications**. The universal build supports Apple silicon and Intel Macs running macOS 10.15 or later.

If macOS blocks an unsigned build, open **System Settings → Privacy & Security** and select **Open Anyway**.

### Install on Linux

**Fedora / RHEL (dnf):** download the `.rpm` and install it:

```bash
sudo dnf install ./md-*.rpm
```

**Other distributions:** download the 64-bit Intel or AMD `.AppImage`. Make it executable, then run it:

```bash
chmod +x md_*.AppImage
./md_*.AppImage
```

You can move the AppImage to any directory after downloading it.

### Install on Windows

Download the `.msi` package and run it. The installer downloads the Microsoft Edge WebView2 runtime when Windows doesn’t already include it.

If Microsoft Defender SmartScreen warns about an unsigned build, review the publisher information before continuing.

## Updating md

md checks for updates on launch and offers to install them in place (you can also run **File → Check for Updates…** anytime). Updates download from GitHub Releases and are verified against the release signature before installing.

- **macOS (DMG or Homebrew)**, **Windows (MSI)**, and **Linux (AppImage)** update over the air — the app restarts itself when done.
- **Linux (RPM)** updates through the package manager instead: `sudo dnf upgrade md` once a newer `.rpm` is installed.

## Releasing (maintainers)

`bun run version` bumps the version, tags, pushes, and triggers the **Release** workflow, which builds the DMG/AppImage/RPM/MSI, signs the updater artifacts, attaches everything to a GitHub Release, and publishes the Homebrew cask to [`SihanTeng/homebrew-md`](https://github.com/SihanTeng/homebrew-md).

Required repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/md.key` (generated once with `bun run tauri -- signer generate`); the matching public key lives in `src-tauri/tauri.conf.json`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key password (empty if none)
- `HOMEBREW_TAP_GITHUB_TOKEN` — PAT with `contents:write` on the tap repo (cask publishing is skipped when unset)
