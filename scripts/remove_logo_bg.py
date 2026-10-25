#!/usr/bin/env python3
"""remove_logo_bg.py — turn logos with a baked background into transparent
PNGs in frontend/public/logos/.

Two source shapes exist:
  - .jpg files from ShanghaiRanking's `logo-jpg` endpoint (JPG has no alpha)
  - .png files whose pixels are fully opaque with a near-white border (PNG
    format does not guarantee transparency — many mirrored PNGs still carry
    a baked white background)

For each candidate, the border-connected near-white region becomes
transparent, the 1px cut edge is softened to kill halos, and small detached
gray specks (JPEG noise, watermark text) are erased. .jpg sources are
replaced by <id>.png; .png sources are rewritten in place.

Run after scripts/mirror_logos.mjs fetches new files:

    python scripts/remove_logo_bg.py
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
LOGOS = ROOT / 'frontend' / 'public' / 'logos'

# min(r,g,b) above this counts as "white". Compression noise means baked
# backgrounds are rarely a clean 255.
WHITE_TH = 235

# A detached blob is treated as leftover noise (watermarks, speckles) and
# erased only when it is small, neutral-gray (not a colored logo element),
# darker than white (so detached white details survive), and mostly
# surrounded by removed background.
SPECK_MAX_FRAC = 0.004
SPECK_MIN_CHROMA = 45
SPECK_MAX_LUMA = 245
SPECK_MIN_LUMA = 60
SPECK_BG_PERIMETER = 0.7

STRUCT = ndimage.generate_binary_structure(2, 2)


def baked_white_bg(path: Path) -> bool:
    """True when a meaningful share of border pixels is opaque near-white —
    a baked background, not real transparency. Logo art may bleed to the
    edge, so only a fraction of the border needs to be white."""
    a = np.asarray(Image.open(path).convert('RGBA'))
    alpha = a[..., 3]
    mn = a[..., :3].min(axis=2)
    border_a = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    border_mn = np.concatenate([mn[0], mn[-1], mn[:, 0], mn[:, -1]])
    white_frac = ((border_a >= 200) & (border_mn >= WHITE_TH)).mean()
    # Mostly-transparent border = already processed or genuinely transparent.
    if (border_a < 200).mean() >= 0.05:
        return False
    return white_frac >= 0.10


def process(path: Path) -> tuple[str, list[str]]:
    src = Image.open(path).convert('RGBA')
    src_alpha = np.asarray(src)[..., 3]
    im = np.asarray(src.convert('RGB')).astype(np.int16)
    minc = im.min(axis=2)
    chroma = im.max(axis=2) - minc

    white = (minc >= WHITE_TH) & (src_alpha >= 200)
    seed = np.zeros_like(white)
    seed[0, :] = white[0, :]
    seed[-1, :] = white[-1, :]
    seed[:, 0] = white[:, 0]
    seed[:, -1] = white[:, -1]
    bg = ndimage.binary_propagation(seed, mask=white, structure=STRUCT)

    notes = []
    h, w = bg.shape
    if bg.mean() < 0.02:
        notes.append(f'WARN background only {bg.mean():.1%} of image — white bg missing?')
    if bg.mean() > 0.55:
        notes.append(f'WARN background {bg.mean():.0%} of image — possible leak into interior')

    # Largest foreground blob is the seal; smaller detached blobs may be
    # leftover gray specks sitting in the margin.
    fg = ~bg
    labels, n = ndimage.label(fg, structure=STRUCT)
    if n > 1:
        sizes = np.bincount(labels.ravel())
        largest = int(np.argmax(sizes[1:])) + 1
        for comp in range(1, n + 1):
            if comp == largest:
                continue
            mask = labels == comp
            area = sizes[comp]
            if area > SPECK_MAX_FRAC * h * w:
                notes.append(f'kept detached blob #{comp} ({area}px) — too big to auto-erase')
                continue
            luma = minc[mask].mean()
            chr_ = chroma[mask].mean()
            perimeter = ndimage.binary_dilation(mask, structure=STRUCT) & ~mask
            bg_adj = (bg[perimeter]).mean() if perimeter.any() else 0.0
            if (
                SPECK_MIN_LUMA < luma < SPECK_MAX_LUMA
                and chr_ < SPECK_MIN_CHROMA
                and bg_adj >= SPECK_BG_PERIMETER
            ):
                bg |= mask
                notes.append(f'erased speck #{comp} ({area}px, luma {luma:.0f}, chroma {chr_:.0f})')
            else:
                notes.append(
                    f'kept detached blob #{comp} ({area}px, luma {luma:.0f}, '
                    f'chroma {chr_:.0f}, bg-adj {bg_adj:.0%})'
                )

    # De-fringe: remaining pixels within 1px of removed bg get alpha scaled by
    # how non-white they are, killing the white halo edges leave.
    alpha = np.full((h, w), 255, dtype=np.uint8)
    alpha[bg] = 0
    ring = ndimage.binary_dilation(bg, structure=STRUCT) & ~bg
    alpha[ring] = np.clip(255 - minc[ring], 0, 255).astype(np.uint8)
    # Pixels transparent in the source stay transparent (RGBA->RGB drops
    # alpha and can leave garbage color channels behind).
    alpha = np.minimum(alpha, src_alpha)

    out = np.dstack([np.asarray(im, dtype=np.uint8), alpha])
    dest = path.with_suffix('.png')
    Image.fromarray(out, 'RGBA').save(dest, optimize=True)
    if dest != path:
        path.unlink()
    return dest.name, notes


def main() -> int:
    candidates = sorted(LOGOS.glob('*.jpg'))
    candidates += [p for p in sorted(LOGOS.glob('*.png')) if baked_white_bg(p)]
    if not candidates:
        print('no logos with baked backgrounds to convert')
        return 0
    print(f'{len(candidates)} files to convert')
    for p in candidates:
        try:
            name, notes = process(p)
            extra = ' | ' + '; '.join(notes) if notes else ''
            print(f'{name}{extra}')
        except Exception as e:
            print(f'FAILED {p.name}: {e}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
