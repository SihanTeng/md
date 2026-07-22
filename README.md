# md

A cross-platform markdown **viewer and editor** built with **Tauri 2**, **React**, **TypeScript**, **Tailwind CSS**, **TipTap** (WYSIWYG), and **Remotion** (present mode + welcome polish).

Native OS window chrome is kept everywhere; the interior UI is styled like a modern macOS document app on Mac, Linux, and Windows.

## Features

- WYSIWYG markdown editing (headings, lists, tasks, links, code, quotes)
- Open / Save / Save As with dirty state and recent files
- Document outline sidebar
- Light / dark theme (system-aware)
- **Present mode** — slides derived from H1/H2 headings via Remotion Player
- Welcome animation on empty state
- Native File / Edit / View menus with keyboard shortcuts

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/) stable
- Platform deps for Tauri: [Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Linux (example)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

### Windows (MSI)

- [Visual Studio C++ build tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (bundler can download the bootstrapper)
- [WiX Toolset v3](https://wixtoolset.org/) on `PATH` for `.msi` packaging

### macOS (DMG)

- Xcode Command Line Tools
- For universal DMGs: both Rust targets installed

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

## Build installers

Configured bundle targets in `src-tauri/tauri.conf.json`:

| Platform | Package | Bundle id |
|----------|---------|-----------|
| macOS | **DMG** | `dmg` |
| Linux | **AppImage** | `appimage` |
| Windows | **MSI** | `msi` |

Tauri **cannot cross-compile** these packages. Each installer must be built on its host OS (or via CI).

### GitHub Actions (all three platforms)

Workflows live under `.github/workflows/`:

| Workflow | When | What |
|----------|------|------|
| `release.yml` | Tag `v*` or manual dispatch | DMG + AppImage + MSI matrix |
| `ci.yml` | PRs / pushes to main | Frontend build + Linux AppImage smoke |

**Release all installers from a version tag:**

```bash
# Bump version in package.json and src-tauri/tauri.conf.json first if needed
git tag v0.1.0
git push origin v0.1.0
```

Then open **Actions → Release installers**. Each matrix job uploads artifacts; on tags they also attach to a **draft GitHub Release**.

**Manual run (no tag):** GitHub → Actions → **Release installers** → **Run workflow**. Download artifacts from the run summary.

Artifact layout after a successful run:

- `md-macos-<n>` → `*.dmg`
- `md-linux-<n>` → `*.AppImage`
- `md-windows-<n>` → `*.msi`

### Local (current OS only)

```bash
# Detect host and build the matching package
npm run build:installers

# Or explicitly:
npm run build:appimage   # Linux → AppImage
npm run build:dmg        # macOS → DMG
npm run build:msi        # Windows → MSI

# List outputs from the last build
npm run build:installers:list

# How to get all three packages
npm run build:installers:help
```

Equivalent shell entrypoint:

```bash
./scripts/build-installers.sh
./scripts/build-installers.sh linux
./scripts/build-installers.sh --list
```

Typical output paths:

```
src-tauri/target/release/bundle/appimage/*.AppImage
src-tauri/target/release/bundle/msi/*.msi
src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
# (or …/release/bundle/dmg/*.dmg for single-arch mac builds)
```

Linux AppImage requires `linuxdeploy` and `linuxdeploy-plugin-appimage`:

```bash
sudo apt-get install -y linuxdeploy linuxdeploy-plugin-appimage
```

Typical output paths:

```
src-tauri/target/release/bundle/appimage/md_0.1.0_amd64.AppImage
src-tauri/target/release/bundle/msi/*.msi
src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
# (or …/release/bundle/dmg/*.dmg for single-arch mac builds)
```

### Unsigned installs

- **macOS**: System Settings → Privacy & Security → Open Anyway (until notarized).
- **Windows**: SmartScreen may warn until the MSI is signed.
- **Linux**: `chmod +x md_*.AppImage && ./md_*.AppImage`

### Code signing (optional)

Wire secrets into `release.yml` when ready:

- macOS: [Signing macOS applications](https://v2.tauri.app/distribute/sign/macos/)
- Windows: [Windows code signing](https://v2.tauri.app/distribute/sign/windows/)

## Icons

```bash
npm run icons   # regenerates PNG/ICO/ICNS via scripts/generate-icon.py
```

## Shortcuts

| Action | macOS | Linux / Windows |
|--------|-------|-----------------|
| New | ⌘N | Ctrl+N |
| Open | ⌘O | Ctrl+O |
| Save | ⌘S | Ctrl+S |
| Save As | ⌘⇧S | Ctrl+Shift+S |
| Present | ⌘⇧P | Ctrl+Shift+P |

In Present mode: ← / → / Space to navigate, Esc to exit.

## Stack

| Layer | Tech |
|-------|------|
| Shell | Tauri 2 |
| UI | React 19, Tailwind 4, lucide-react |
| Editor | TipTap 3 |
| Markdown I/O | marked + Turndown |
| Present / motion | Remotion Player |
| Backend | Rust (fs, dialog, menu, recent files) |

## License

MIT
