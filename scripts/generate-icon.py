#!/usr/bin/env python3
"""Generate the TenLing app icon set from the brand master artwork.

Primary path: rasterize `assets/icon/master-source.jpg` (or .png) through a
squircle mask into PNG / ICO / ICNS for Tauri, public/, and docs/.

Fallback: if no master exists, paint a procedural mark (document + light stroke).

Usage:
  python3 scripts/generate-icon.py
  python3 scripts/generate-icon.py --source path/to/art.jpg
"""

from __future__ import annotations

import argparse
import math
import os
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src-tauri" / "icons"
ASSETS_DIR = ROOT / "assets" / "icon"
PUBLIC = ROOT / "public"
DOCS_ASSETS = ROOT / "docs" / "assets"
DEFAULT_MASTER = ASSETS_DIR / "master-source.jpg"


def squircle_mask(size: int, n: float = 4.6) -> Image.Image:
    """Smooth iOS-style superellipse alpha mask."""
    mask = Image.new("L", (size, size), 0)
    px = mask.load()
    cx = cy = (size - 1) / 2.0
    r = size / 2.0 * 0.992
    for y in range(size):
        for x in range(size):
            nx = abs((x - cx) / r)
            ny = abs((y - cy) / r)
            d = nx**n + ny**n
            if d <= 0.88:
                px[x, y] = 255
            elif d <= 1.0:
                t = (1.0 - d) / 0.12
                px[x, y] = max(0, min(255, int(255 * (t**0.65))))
    return mask


def soft_vignette(size: int) -> Image.Image:
    """Subtle edge darkening to ground the icon on light wallpapers."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for i in range(12):
        a = int(10 * (i / 11) ** 1.6)
        inset = int(size * 0.01 * i)
        draw.rounded_rectangle(
            [inset, inset, size - 1 - inset, size - 1 - inset],
            radius=int(size * 0.22),
            outline=(0, 0, 0, a),
            width=max(1, size // 400),
        )
    return layer.filter(ImageFilter.GaussianBlur(radius=max(1, size // 80)))


def load_master(path: Path, size: int = 2048) -> Image.Image:
    img = Image.open(path).convert("RGB")
    # Center-crop to square if needed
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    # Gentle polish
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    img = ImageEnhance.Sharpness(img).enhance(1.08)
    return img.convert("RGBA")


def paint_fallback(size: int) -> Image.Image:
    """Procedural document + light stroke if master art is missing."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Gradient: sapphire → violet
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(55 + (150 - 55) * t)
        g = int(110 + (90 - 110) * t)
        b = int(245 + (220 - 245) * t)
        draw.line([(0, y), (size - 1, y)], fill=(r, g, b, 255))

    # Top sheen
    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    for y in range(size // 2):
        a = int(70 * (1 - y / (size / 2)) ** 1.5)
        sd.line([(0, y), (size - 1, y)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img, sheen)

    # Soft page (tilted via affine)
    page = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(page)
    margin = int(size * 0.22)
    pw, ph = size - 2 * margin, int(size * 0.52)
    px0, py0 = margin, int(size * 0.24)
    # shadow
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [px0 + size * 0.02, py0 + size * 0.03, px0 + pw + size * 0.02, py0 + ph + size * 0.03],
        radius=int(size * 0.04),
        fill=(40, 20, 90, 50),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(4, size // 50)))
    img = Image.alpha_composite(img, shadow)

    pd.rounded_rectangle(
        [px0, py0, px0 + pw, py0 + ph],
        radius=int(size * 0.04),
        fill=(250, 250, 255, 245),
    )
    # folded corner
    fold = int(size * 0.10)
    pd.polygon(
        [
            (px0 + pw - fold, py0),
            (px0 + pw, py0),
            (px0 + pw, py0 + fold),
        ],
        fill=(210, 200, 240, 255),
    )
    pd.polygon(
        [
            (px0 + pw - fold, py0),
            (px0 + pw - fold, py0 + fold),
            (px0 + pw, py0 + fold),
        ],
        fill=(235, 230, 250, 255),
    )
    # light stroke
    stroke = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stroke)
    # quadratic-ish polyline
    pts = []
    for i in range(40):
        u = i / 39
        x = px0 + pw * 0.22 + pw * 0.55 * u
        y = py0 + ph * 0.72 - ph * 0.55 * math.sin(u * math.pi * 0.85) + ph * 0.08 * u
        pts.append((x, y))
    for w, a in ((size // 28, 40), (size // 45, 120), (size // 70, 230)):
        sd.line(pts, fill=(255, 255, 255, a), width=max(2, w), joint="curve")
    # tip glow
    tip = pts[-1]
    r = size // 40
    sd.ellipse([tip[0] - r, tip[1] - r, tip[0] + r, tip[1] + r], fill=(255, 255, 255, 180))
    stroke = stroke.filter(ImageFilter.GaussianBlur(radius=max(1, size // 200)))
    page = Image.alpha_composite(page, stroke)
    page = page.rotate(-8, resample=Image.Resampling.BICUBIC, center=(size / 2, size / 2))
    img = Image.alpha_composite(img, page)
    return img


def apply_squircle(src: Image.Image) -> Image.Image:
    size = src.size[0]
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rgba = src.convert("RGBA")
    # slight vignette for depth
    rgba = Image.alpha_composite(rgba, soft_vignette(size))
    out.paste(rgba, (0, 0), mask=squircle_mask(size))
    return out


def write_svg() -> None:
    """Vector companion approximating the document + light stroke mark."""
    svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#3B78F5"/>
      <stop offset="45%" stop-color="#6B6AF0"/>
      <stop offset="100%" stop-color="#B06AE8"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F0ECFF"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.7"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#2A1A60" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect x="2" y="2" width="124" height="124" rx="28" ry="28" fill="url(#bg)"/>
  <g transform="rotate(-8 64 64)" filter="url(#soft)">
    <rect x="34" y="30" width="60" height="72" rx="7" fill="url(#page)"/>
    <path d="M78 30 L94 30 L94 46 Z" fill="#D8D0F5"/>
    <path d="M78 30 L78 46 L94 46 Z" fill="#EDE8FC"/>
    <path d="M48 86 C58 62 72 52 88 40" fill="none" stroke="url(#stroke)" stroke-width="4.5"
          stroke-linecap="round"/>
    <circle cx="88" cy="40" r="3.2" fill="#FFFFFF" fill-opacity="0.9"/>
  </g>
</svg>
"""
    (PUBLIC / "icon.svg").write_text(svg)


def write_icns(master: Image.Image, path: Path) -> None:
    def png_bytes(s: int) -> bytes:
        buf = BytesIO()
        master.resize((s, s), Image.Resampling.LANCZOS).save(buf, format="PNG")
        return buf.getvalue()

    mapping = [
        (b"icp4", 16),
        (b"icp5", 32),
        (b"icp6", 64),
        (b"ic07", 128),
        (b"ic08", 256),
        (b"ic09", 512),
        (b"ic10", 1024),
    ]
    chunks = []
    for ostype, s in mapping:
        data = png_bytes(s)
        chunks.append(ostype + struct.pack(">I", len(data) + 8) + data)
    body = b"".join(chunks)
    path.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TenLing icon set")
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Master artwork (jpg/png). Defaults to assets/icon/master-source.jpg",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DOCS_ASSETS.mkdir(parents=True, exist_ok=True)

    source = args.source
    if source is None and DEFAULT_MASTER.exists():
        source = DEFAULT_MASTER

    if source is not None and source.exists():
        print(f"Using master art: {source}")
        base = load_master(source, 2048)
    else:
        print("No master art — painting procedural fallback")
        base = paint_fallback(2048)

    hi = apply_squircle(base)
    master = hi.resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(ASSETS_DIR / "icon-1024.png")

    # Preview card
    preview = Image.new("RGBA", (1200, 1200), (245, 245, 247, 255))
    sh = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([140, 170, 1060, 1110], radius=220, fill=(0, 0, 0, 38))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=42))
    preview = Image.alpha_composite(preview, sh)
    icon = master.resize((1000, 1000), Image.Resampling.LANCZOS)
    preview.paste(icon, (100, 80), icon)
    preview.save(ASSETS_DIR / "icon-preview.png")

    targets = {
        OUT_DIR / "icon.png": 512,
        OUT_DIR / "32x32.png": 32,
        OUT_DIR / "128x128.png": 128,
        OUT_DIR / "128x128@2x.png": 256,
        OUT_DIR / "Square30x30Logo.png": 30,
        OUT_DIR / "Square44x44Logo.png": 44,
        OUT_DIR / "Square71x71Logo.png": 71,
        OUT_DIR / "Square89x89Logo.png": 89,
        OUT_DIR / "Square107x107Logo.png": 107,
        OUT_DIR / "Square142x142Logo.png": 142,
        OUT_DIR / "Square150x150Logo.png": 150,
        OUT_DIR / "Square284x284Logo.png": 284,
        OUT_DIR / "Square310x310Logo.png": 310,
        OUT_DIR / "StoreLogo.png": 50,
        PUBLIC / "icon.png": 512,
        DOCS_ASSETS / "icon.png": 512,
        DOCS_ASSETS / "logo.png": 256,
    }
    for path, s in targets.items():
        master.resize((s, s), Image.Resampling.LANCZOS).save(path)

    ico_sizes = [256, 128, 64, 48, 32, 24, 16]
    icos = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]
    icos[0].save(OUT_DIR / "icon.ico", format="ICO", append_images=icos[1:])
    write_icns(master, OUT_DIR / "icon.icns")
    write_svg()

    # Keep a copy of the processed master for reference
    master.save(ASSETS_DIR / "icon-master.png")
    print(f"Wrote TenLing icons under {OUT_DIR}, {ASSETS_DIR}, {PUBLIC}, {DOCS_ASSETS}")


if __name__ == "__main__":
    main()
