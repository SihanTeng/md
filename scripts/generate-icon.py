#!/usr/bin/env python3
"""Generate the md app icon set (PNG, ICO) from vector-like raster painting.

Usage:
  python3 scripts/generate-icon.py
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src-tauri" / "icons"
ASSETS_DIR = ROOT / "assets" / "icon"
PUBLIC = ROOT / "public"

FONT_CANDIDATES = [
    "/usr/share/fonts/rsms-inter-fonts/InterDisplay-ExtraBold.ttf",
    "/usr/share/fonts/rsms-inter-fonts/Inter-ExtraBold.ttf",
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
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    top = (28, 140, 255)
    bottom = (0, 96, 224)
    for y in range(size):
        t = y / max(1, size - 1)
        draw.line(
            [(0, y), (size - 1, y)],
            fill=(lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t), 255),
        )

    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    for y in range(size // 2):
        a = int(48 * (1 - y / (size / 2)) ** 1.8)
        sd.line([(0, y), (size - 1, y)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img, sheen)

    pad_x = int(size * 0.20)
    pad_y = int(size * 0.17)
    card_w = size - 2 * pad_x
    card_h = size - 2 * pad_y
    radius = int(size * 0.09)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh = ImageDraw.Draw(shadow)
    off = max(2, size // 48)
    sh.rounded_rectangle(
        [pad_x + off, pad_y + off * 1.5, pad_x + card_w + off, pad_y + card_h + off * 1.5],
        radius=radius,
        fill=(0, 35, 90, 55),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(2, size // 50)))
    img = Image.alpha_composite(img, shadow)

    card = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle(
        [pad_x, pad_y, pad_x + card_w, pad_y + card_h],
        radius=radius,
        fill=(252, 252, 254, 245),
    )
    line_y1 = pad_y + int(card_h * 0.72)
    line_y2 = pad_y + int(card_h * 0.80)
    inset = int(card_w * 0.18)
    cd.rounded_rectangle(
        [pad_x + inset, line_y1, pad_x + card_w - inset, line_y1 + max(2, size // 85)],
        radius=max(1, size // 200),
        fill=(0, 100, 220, 40),
    )
    cd.rounded_rectangle(
        [
            pad_x + inset + int(card_w * 0.08),
            line_y2,
            pad_x + card_w - inset - int(card_w * 0.08),
            line_y2 + max(2, size // 95),
        ],
        radius=max(1, size // 200),
        fill=(0, 100, 220, 28),
    )
    img = Image.alpha_composite(img, card)

    font_path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if not font_path:
        raise SystemExit("Inter ExtraBold font not found")
    font = ImageFont.truetype(font_path, int(size * 0.36))
    text = "md"
    bbox = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = pad_y + card_h * 0.22 - bbox[1]

    text_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(text_shadow).text(
        (tx, ty + size * 0.01), text, font=font, fill=(0, 55, 130, 50)
    )
    text_shadow = text_shadow.filter(ImageFilter.GaussianBlur(radius=max(1, size // 100)))
    img = Image.alpha_composite(img, text_shadow)

    monogram = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(monogram).text((tx, ty), text, font=font, fill=(0, 102, 230, 255))
    img = Image.alpha_composite(img, monogram)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask=squircle_mask(size))
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

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
    }
    for path, s in targets.items():
        master.resize((s, s), Image.Resampling.LANCZOS).save(path)

    ico_sizes = [256, 128, 64, 48, 32, 24, 16]
    icos = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]
    icos[0].save(OUT_DIR / "icon.ico", format="ICO", append_images=icos[1:])

    # PNG-based ICNS (macOS 10+)
    import struct
    from io import BytesIO

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

    print(f"Wrote icons under {OUT_DIR} and {ASSETS_DIR}")


if __name__ == "__main__":
    main()
