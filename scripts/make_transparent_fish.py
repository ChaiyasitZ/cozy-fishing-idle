"""Convert black-background fish art to transparent PNGs and tighten crop."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(
    r"C:\Users\chaiyasit\.cursor\projects\c-Users-chaiyasit-Documents-GitHub-cozy-fishing-idle\assets"
)
OUT = ROOT / "public" / "fish"

# Earlier runs produced catfish.png from 06fd4f84 and carp.png from 2986f868.
JOBS = [
    ("e5a4f48f", "climbing_perch.png"),  # ปลาหมอไทย
    ("e1d1a70c", "snakehead.png"),  # ปลาช่อน
    ("abad7ce1", "tilapia.png"),  # ปลานิล
]

TARGET_W, TARGET_H = 512, 342


def find_source(token: str) -> Path:
    matches = sorted(ASSETS.glob(f"*{token}*"))
    if not matches:
        raise FileNotFoundError(token)
    return matches[0]


def cut_black_bg(
    img: Image.Image,
    dark_max: int = 32,
    feather: int = 3,
    solid_lum: int = 64,
) -> Image.Image:
    """Drop the black backdrop while keeping dark markings inside the fish."""
    rgb = np.asarray(img.convert("RGBA"), dtype=np.float32)[:, :, :3]
    lum = rgb.max(axis=2)

    # Only dark regions connected to the image border are backdrop; dark fins
    # and outlines enclosed by the body must survive.
    labels, _ = ndimage.label(lum <= dark_max)
    edge_labels = np.unique(
        np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    )
    backdrop = np.isin(labels, edge_labels[edge_labels != 0])

    alpha = np.where(backdrop, 0.0, 1.0)

    # The art was composited onto black, so antialiased rim pixels are already
    # premultiplied: recover coverage from luminance, then undo the multiply so
    # the outline does not fringe dark against the cozy paper background.
    rim = ndimage.binary_dilation(backdrop, iterations=feather) & ~backdrop
    alpha = np.where(rim, np.minimum(alpha, np.clip(lum / solid_lum, 0.0, 1.0)), alpha)

    straight = np.clip(rgb / np.maximum(alpha, 1e-3)[:, :, None], 0, 255)
    stacked = np.dstack([straight, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(stacked, "RGBA")


def trim_to_art(img: Image.Image) -> Image.Image:
    box = img.split()[-1].getbbox() or (0, 0, img.width, img.height)
    left, top, right, bottom = box
    pad_x = max(4, int((right - left) * 0.04))
    pad_y = max(4, int((bottom - top) * 0.06))
    return img.crop(
        (
            max(0, left - pad_x),
            max(0, top - pad_y),
            min(img.width, right + pad_x),
            min(img.height, bottom + pad_y),
        )
    )


def fit_canvas(art: Image.Image, inset: float = 0.06) -> Image.Image:
    """Centre the fish on the shared landscape canvas every card expects."""
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    scale = min(
        TARGET_W * (1 - inset * 2) / art.width,
        TARGET_H * (1 - inset * 2) / art.height,
    )
    size = (max(1, round(art.width * scale)), max(1, round(art.height * scale)))
    resized = art.resize(size, Image.Resampling.LANCZOS)
    canvas.paste(resized, ((TARGET_W - size[0]) // 2, (TARGET_H - size[1]) // 2), resized)
    return canvas


def process(src: Path, dest: Path) -> None:
    art = trim_to_art(cut_black_bg(Image.open(src)))
    canvas = fit_canvas(art)
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, optimize=True)
    print(f"{dest.name}: fish={art.size} -> {canvas.size}")


def main() -> None:
    for token, name in JOBS:
        process(find_source(token), OUT / name)


if __name__ == "__main__":
    main()
