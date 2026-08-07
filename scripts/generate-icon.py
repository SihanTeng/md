#!/usr/bin/env python3
"""Generate the TenLing app icon set (PNG, ICO, ICNS) from vector-like raster painting.

Design: soft indigo→violet squircle, luminous white "TL" monogram, quiet
underline accent (writing mark). No document-card clutter — monogram-first.

Usage:
  python3 scripts/generate-icon.py
"""

from __future__ import annotations

import os
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src-tauri" / "icons"
ASSETS_DIR = ROOT / "assets" / "icon"
PUBLIC = ROOT / "public"
DOCS_ASSETS = ROOT / "docs" / "assets"

FONT_CANDIDATES = [
    "/usr/share/fonts/rsms-inter-fonts/InterDisplay-ExtraBold.ttf",
    "/usr/share/fonts/rsms-inter-fonts/Inter-ExtraBold.ttf",
    "/usr/share/fonts/truetype/inter/Inter-ExtraBold.ttf",
    "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
]


def squircle_mask(size: int, n: float = 5.0) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    px = mask.load()
    cx = cy = (size - 1) / 2.0
    r = size / 2.0 * 0.985
    for y in range(size):
        for x in range(size):
            nx = abs((x - cx) / r)
            ny = abs((y - cy) / r)
            d = nx**n + ny**n
            if d <= 0.90:
                px[x, y] = 255
            elif d <= 1.0:
                t = (1.0 - d) / 0.10
                px[x, y] = max(0, min(255, int(255 * (t**0.7))))
    return mask


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def paint_icon(size: int) -> Image.Image:
    """TenLing mark: indigo→violet gradient squircle + TL monogram."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Diagonal-ish vertical gradient: cool indigo → soft violet (bright, calm)
    top = (72, 108, 255)  # #486CFF
    mid = (98, 88, 245)  # #6258F5
    bottom = (132, 72, 232)  # #8448E8
    for y in range(size):
        t = y / max(1, size - 1)
        if t < 0.55:
            u = t / 0.55
            c = (
                lerp(top[0], mid[0], u),
                lerp(top[1], mid[1], u),
                lerp(top[2], mid[2], u),
                255,
            )
        else:
            u = (t - 0.55) / 0.45
            c = (
                lerp(mid[0], bottom[0], u),
                lerp(mid[1], bottom[1], u),
                lerp(mid[2], bottom[2], u),
                255,
            )
        draw.line([(0, y), (size - 1, y)], fill=c)

    # Soft top sheen
    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    for y in range(size // 2):
        a = int(56 * (1 - y / (size / 2)) ** 1.6)
        sd.line([(0, y), (size - 1, y)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img, sheen)

    # Soft radial glow behind monogram
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx = cy = size / 2
    r_glow = size * 0.38
    for i in range(18, 0, -1):
        rr = r_glow * (i / 18)
        a = int(22 * (i / 18) ** 1.4)
        gd.ellipse(
            [cx - rr, cy - rr * 0.92, cx + rr, cy + rr * 0.92],
            fill=(255, 255, 255, a),
        )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, size // 40)))
    img = Image.alpha_composite(img, glow)

    font_path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if not font_path:
        raise SystemExit("Inter ExtraBold font not found — install inter-fonts")
    font = ImageFont.truetype(font_path, int(size * 0.42))
    text = "TL"
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bbox = probe.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] - size * 0.03

    # Monogram soft shadow
    text_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(text_shadow).text(
        (tx, ty + size * 0.012), text, font=font, fill=(40, 20, 90, 70)
    )
    text_shadow = text_shadow.filter(ImageFilter.GaussianBlur(radius=max(2, size // 90)))
    img = Image.alpha_composite(img, text_shadow)

    monogram = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(monogram).text((tx, ty), text, font=font, fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img, monogram)

    # Quiet writing accent — two soft underlines under monogram
    accent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ad = ImageDraw.Draw(accent)
    line_y = ty + th + size * 0.08
    line_h = max(2, size // 90)
    inset = size * 0.28
    ad.rounded_rectangle(
        [inset, line_y, size - inset, line_y + line_h],
        radius=line_h,
        fill=(255, 255, 255, 70),
    )
    ad.rounded_rectangle(
        [inset + size * 0.06, line_y + line_h * 2.4, size - inset - size * 0.06, line_y + line_h * 3.3],
        radius=line_h,
        fill=(255, 255, 255, 40),
    )
    img = Image.alpha_composite(img, accent)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask=squircle_mask(size))
    return out


def write_svg() -> None:
    """Vector companion for README / web (matches the raster mark)."""
    svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#486CFF"/>
      <stop offset="55%" stop-color="#6258F5"/>
      <stop offset="100%" stop-color="#8448E8"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="42%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="2" y="2" width="124" height="124" rx="28" ry="28" fill="url(#bg)"/>
  <rect x="2" y="2" width="124" height="124" rx="28" ry="28" fill="url(#glow)"/>
  <text x="64" y="76" text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        font-size="46" font-weight="800" fill="#FFFFFF" letter-spacing="-2">TL</text>
  <rect x="36" y="88" width="56" height="3" rx="1.5" fill="#FFFFFF" fill-opacity="0.28"/>
  <rect x="44" y="96" width="40" height="2.5" rx="1.25" fill="#FFFFFF" fill-opacity="0.16"/>
</svg>
"""
    (PUBLIC / "icon.svg").write_text(svg)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DOCS_ASSETS.mkdir(parents=True, exist_ok=True)

    hi = paint_icon(2048)
    master = hi.resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(ASSETS_DIR / "icon-1024.png")

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
    (OUT_DIR / "icon.icns").write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)

    write_svg()
    print(f"Wrote TenLing icons under {OUT_DIR}, {ASSETS_DIR}, {PUBLIC}, {DOCS_ASSETS}")


if __name__ == "__main__":
    main()
