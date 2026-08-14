"""Tighten crop around fish pixels so portraits fill the UI box better."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(
    r"C:\Users\chaiyasit\.cursor\projects\c-Users-chaiyasit-Documents-GitHub-cozy-fishing-idle\assets"
)
OUT = ROOT / "public" / "fish"

JOBS = [
    ("201e3f3c", "tilapia.png"),
    ("5ebc915e", "carp.png"),
    ("631f0f26", "catfish.png"),
    ("bcec18d5", "climbing_perch.png"),  # pla mor
    ("07279a98", "snakehead.png"),
]


def find_source(token: str) -> Path:
    matches = sorted(ASSETS.glob(f"*{token}*"))
    if not matches:
        raise FileNotFoundError(f"No asset matching *{token}*")
    return matches[0]


def content_bbox(img: Image.Image, tol: int = 14) -> tuple[int, int, int, int]:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    bg = px[4, 4][:3]

    def is_fg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 20:
            return False
        return abs(r - bg[0]) > tol or abs(g - bg[1]) > tol or abs(b - bg[2]) > tol

    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    step = 1
    for y in range(0, h, step):
        for x in range(0, w, step):
            if is_fg(x, y):
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return (0, 0, w, h)
    return (min_x, min_y, max_x + 1, max_y + 1)


def crop_to_fish(src: Path, dest: Path) -> None:
    img = Image.open(src).convert("RGBA")
    left, top, right, bottom = content_bbox(img)
    bw, bh = right - left, bottom - top
    # Tight visual padding (~5%) so fish fills the box
    pad_x = max(6, int(bw * 0.05))
    pad_y = max(6, int(bh * 0.08))
    left = max(0, left - pad_x)
    top = max(0, top - pad_y)
    right = min(img.width, right + pad_x)
    bottom = min(img.height, bottom + pad_y)

    cropped = img.crop((left, top, right, bottom))
    # Normalize to shared landscape canvas; letterbox with source bg color
    target_w, target_h = 512, 342  # ~3:2
    bg = img.getpixel((4, 4))
    canvas = Image.new("RGBA", (target_w, target_h), bg)
    # Fit fish inside with small inset, preserve aspect
    inset = 0.04
    max_w = int(target_w * (1 - inset * 2))
    max_h = int(target_h * (1 - inset * 2))
    scale = min(max_w / cropped.width, max_h / cropped.height)
    new_size = (max(1, int(cropped.width * scale)), max(1, int(cropped.height * scale)))
    # Prefer high-quality downsample for these detailed pixel illustrations
    resized = cropped.resize(new_size, Image.Resampling.LANCZOS)
    ox = (target_w - new_size[0]) // 2
    oy = (target_h - new_size[1]) // 2
    canvas.paste(resized, (ox, oy), resized)
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, optimize=True)
    print(f"{src.name} -> {dest.name} fish={cropped.size} out={canvas.size} scale={scale:.2f}")


def main() -> None:
    for token, name in JOBS:
        try:
            crop_to_fish(find_source(token), OUT / name)
        except FileNotFoundError as e:
            # Fallback: retighten from existing public file
            existing = OUT / name
            if existing.exists():
                tmp = OUT / f"_src_{name}"
                existing.replace(tmp)
                try:
                    crop_to_fish(tmp, existing)
                finally:
                    tmp.unlink(missing_ok=True)
            else:
                print(f"skip: {e}")


if __name__ == "__main__":
    main()
