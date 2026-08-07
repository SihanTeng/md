# Competitive analysis: mature Markdown apps vs `TenLing`

Point-in-time analysis (2026-07) comparing TenLing against mature open-source and
closed-source Markdown applications, with a prioritized roadmap.

## Where `TenLing` sits in the landscape

Markdown apps split into three categories:

- **Single-file WYSIWYG editors** — Typora ($14.99, closed), MarkText (open
  source), ghostwriter (open source), Apostrophe (open source). **This is our
  lane.**
- **Knowledge bases** — Obsidian, Joplin, Logseq, Zettlr. Vault-based, plugins,
  sync, graphs. A different product; chasing them is a trap.
- **Markdown-to-slides tools** — Marp (open source), Deckset ($29, closed),
  Slidev. Our presentation mode overlaps here, and no app in the editor lane
  has one.

The honest benchmark is therefore **Typora/MarkText for editing** and
**Marp/Deckset for presenting**. The positioning — one portable `.md` file,
visual editing, present from the same file — is genuinely differentiated:
nobody else combines the two lanes.

## Feature comparison

| Capability | TenLing | Typora | MarkText | ghostwriter | iA Writer | Marp/Deckset |
|---|---|---|---|---|---|---|
| Live-rendered editing (Typora-style) | ✅ | ✅ | ✅ | split preview | partial | — |
| Source-code mode | ❌ | ✅ | ✅ | ✅ (source-first) | ✅ | ✅ |
| Export PDF/HTML/Word | ✅ | ✅ all + ePub/LaTeX | PDF/HTML | via Pandoc | docx/PDF/HTML | PDF/PPTX/HTML |
| Print | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Find & replace in doc | ✅ | ✅ | ✅ | ✅ | ✅ | n/a |
| Tables: edit UI (rows/cols) | ❌ insert 3×2 only | ✅ excellent | ✅ | basic | ✅ | render only |
| Footnotes / math / frontmatter | frontmatter ✅ | ✅ all | ✅ | partial | footnotes/frontmatter | math ✅ / frontmatter ✅ |
| Speaker notes / presenter view | ❌ | n/a | n/a | n/a | n/a | ✅ both |
| Deck export | ❌ | n/a | n/a | n/a | n/a | ✅ PDF/PPTX |
| File assoc / drag-drop / CLI open | ❌ | ✅ | ✅ | ✅ | ✅ | drag-drop ✅ |
| File watching (external edits) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ live reload |
| Tabs / multi-doc | ❌ | ✅ | ✅ | ✅ | ✅ | n/a |
| Focus / typewriter mode | ❌ | ✅ both | typewriter | ✅ both | ✅ both (gold standard) | — |
| Word count | ✅ | ✅ | ✅ | ✅ + session goals | ✅ | — |
| Themes | light/dark | many + custom CSS | several | several + custom CSS | curated | many deck themes |
| Footprint | small (system webview) | medium | Electron (heavy) | Qt (light) | native | VS Code ext / Electron |
| Auto-update | ✅ signed OTA | ✅ | partial | package mgr | App Store | ✅ |

Sources: typora.io, ia.net/writer, marp.app, the Deckset↔Marp comparison in
marp-team discussion #68, and 2025–2026 editor roundups (docsio, TechTarget).

## Data-integrity issues found (fixed before any feature work)

The audit of the marked → TipTap → turndown pipeline found cases where `TenLing`
silently destroyed user content:

- **Strikethrough and underline deleted on save** — both were creatable in the
  editor (toolbar, typing) but the turndown serializer had no rule for them.
- **H4–H6 flattened to plain paragraphs** — the schema capped headings at
  level 3, so `#### x` loaded as body text and saved back without hashes.
- **Closing the window discarded unsaved changes** — the discard prompt
  guarded New/Open but no `closeRequested` handler existed.
- **YAML frontmatter destroyed** — a leading `---` block parsed as a
  horizontal rule; HTML comments were likewise stripped on load.

Every mature competitor round-trips what it renders. These were trust-killers
and outranked all feature work.

## Roadmap (what to steal, in priority order)

### P0 — Data integrity (every competitor's playbook) — ✅ done

- ~~Turndown rules for strike (`~~x~~`) and underline (`<u>x</u>`, Typora's
  convention); support H4–H6; preserve frontmatter and HTML comments
  verbatim.~~ Comments ride through the editor as atom nodes (muted chips)
  and round-trip byte-for-byte, including inside code fences.
- ~~Unsaved-changes guard on window close (`closeRequested`).~~ Both window
  close and Cmd+Q are intercepted in Rust and confirmed via native dialog.
- ~~External-file-change detection~~ — mtime poll on window focus; clean
  documents reload silently, dirty ones ask first (Typora behavior).

### P1 — Table stakes every mature editor has

- **Export**: HTML (marked output + bundled CSS), PDF via the webview's
  print-to-PDF, copy-as-HTML (Markdown Monster style). The single most-cited
  Typora strength. **✅ done** — File → Export HTML…/Export PDF… (system
  print dialog), Edit → Copy as HTML.
- **Find & replace** (Cmd+F) — universal expectation. **✅ done** —
  decoration-based overlay with match count, case toggle, replace/replace-all.
- **Source mode toggle** (Typora's Cmd+/) — escape hatch for constructs the
  visual editor can't represent (footnotes, raw HTML); turns "lossy" into
  "editable".
- **Open-with integration**: `bundle.fileAssociations`, drag-and-drop onto the
  window, CLI argv opening. Makes `TenLing` a real default-handler citizen.
- **Table editing UI** — add/remove rows/cols, alignment. Typora's most-
  praised feature; the schema already supports it, only UI is missing.

### P2 — Deepen the differentiator (steal from Marp/Deckset)

- Speaker notes (`<!-- notes -->` or `^ notes` convention) + presenter view.
- Deck export to PDF/HTML — Marp's core value; feeds the "one file, two
  outputs" story.
- **Export deck as MP4 video** — Remotion already ships with the app;
  Deckset and Marp stop at PDF/PPTX, so this would be unique in the space.
- Slide themes (2–3) and an overview grid.

### P2 — Editor depth (steal from iA Writer/Typora)

- Focus mode (dim all but the current paragraph/sentence) and typewriter
  scrolling — iA Writer's signature, cheap to build on decorations.
- Zoom controls and fullscreen.
- Command palette (Cmd+K) over the existing ~24 actions — Obsidian-trained
  users expect it; small surface here.

### P3 — Long tail, only if the audience asks

- Footnotes, math (KaTeX), `==highlight==` — marked has official extensions;
  mainly academic/technical writers (Zettlr's crowd).
- Tabs, custom CSS themes (Typora's theming community is a real moat), image
  resize handles.
- **Deliberately skip**: vaults, backlinks, graphs, sync, plugin APIs
  (Obsidian/Joplin territory — different product, infinite scope).

## Existing strengths (keep and market)

- Small footprint via the system webview — MarkText/Zettlr ship Electron.
- Signed OTA updates, Homebrew cask, four installer formats — distribution is
  ahead of most open-source peers (MarkText's release cadence has stalled, so
  a maintained alternative has an opening).
- Atomic temp+rename saves, session restore, `assets/` image folder with
  collision-free names (same model as Typora), reduced-motion support.
- The presentation mode itself — the right differentiator; it needs the
  Marp/Deckset table stakes (notes, export) to be credible.
