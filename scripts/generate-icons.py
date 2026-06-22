#!/usr/bin/env python3
"""Generate RETROCLOUD PWA icons (192, 512, maskable variants) as PNG via Pillow."""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path("/home/z/my-project/public/icons")
OUT.mkdir(parents=True, exist_ok=True)

BG = (10, 10, 20)
AMBER = (245, 183, 61)
MAGENTA = (200, 80, 220)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    pad = int(size * 0.1) if maskable else int(size * 0.15)
    inner = size - 2 * pad

    cx, cy = size // 2, size // 2
    r = inner // 2

    d.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=AMBER,
        width=max(2, size // 80),
    )

    dpad_cx, dpad_cy = cx, cy
    dpad_size = int(r * 0.9)
    arm = dpad_size // 3
    thick = dpad_size // 4
    d.rectangle(
        [dpad_cx - arm, dpad_cy - thick // 2, dpad_cx + arm, dpad_cy + thick // 2],
        fill=AMBER,
    )
    d.rectangle(
        [dpad_cx - thick // 2, dpad_cy - arm, dpad_cx + thick // 2, dpad_cy + arm],
        fill=AMBER,
    )

    btn_r = max(2, size // 40)
    btn_offset = int(r * 0.55)
    d.ellipse(
        [cx + btn_offset - btn_r, cy - btn_offset - btn_r,
         cx + btn_offset + btn_r, cy - btn_offset + btn_r],
        fill=MAGENTA,
    )
    d.ellipse(
        [cx + btn_offset + btn_r * 2 - btn_r, cy - btn_offset + btn_r * 2 - btn_r,
         cx + btn_offset + btn_r * 2 + btn_r, cy - btn_offset + btn_r * 2 + btn_r],
        fill=MAGENTA,
    )

    return img


for size in [192, 512]:
    img = make_icon(size, maskable=False)
    img.save(OUT / f"icon-{size}.png", "PNG")
    img_m = make_icon(size, maskable=True)
    img_m.save(OUT / f"icon-maskable-{size}.png", "PNG")

img = make_icon(180, maskable=False)
img.save(OUT / "apple-touch-icon.png", "PNG")

img = make_icon(32, maskable=False)
img.save(OUT / "favicon-32.png", "PNG")

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a14"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#f5b73d" stroke-width="8"/>
  <rect x="176" y="240" width="160" height="32" fill="#f5b73d"/>
  <rect x="240" y="176" width="32" height="160" fill="#f5b73d"/>
  <circle cx="320" cy="200" r="14" fill="#c850dc"/>
  <circle cx="350" cy="230" r="14" fill="#c850dc"/>
</svg>
"""
(OUT / "icon.svg").write_text(svg)

print("OK — icons generated in", OUT)
