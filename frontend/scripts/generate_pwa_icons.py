from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
public_dir = root / 'public'
public_dir.mkdir(exist_ok=True)


def make_icon(size: int, path: Path, maskable: bool = False):
    img = Image.new('RGBA', (size, size), '#FAF6EF')
    draw = ImageDraw.Draw(img)
    margin = size * 0.12
    radius = int(size * 0.16)

    draw.rounded_rectangle(
        [(margin, margin), (size - margin, size - margin)],
        radius=radius,
        fill='#A6192E',
    )

    inner_margin = margin + int(size * 0.06)
    draw.rounded_rectangle(
        [(inner_margin, inner_margin), (size - inner_margin, size - inner_margin)],
        radius=max(8, int(size * 0.12)),
        outline='#FAF6EF',
        width=max(2, size // 48),
    )

    motif_y = size * 0.62
    draw.line(
        [
            (size * 0.22, motif_y),
            (size * 0.32, motif_y - size * 0.1),
            (size * 0.42, motif_y),
            (size * 0.52, motif_y - size * 0.1),
            (size * 0.72, motif_y),
        ],
        fill='#C9A227',
        width=max(3, size // 40),
        joint='curve',
    )

    font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', int(size * 0.28))
    text = 'TRC'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_x = (size - text_width) / 2
    text_y = size * 0.36
    draw.text((text_x, text_y), text, font=font, fill='#FAF6EF')

    if maskable:
        alpha = Image.new('L', (size, size), 0)
        alpha_draw = ImageDraw.Draw(alpha)
        alpha_draw.rounded_rectangle(
            [(size * 0.14, size * 0.14), (size * 0.86, size * 0.86)],
            radius=int(size * 0.18),
            fill=255,
        )
        img.putalpha(alpha)

    img.save(path)


make_icon(192, public_dir / 'pwa-192x192.png')
make_icon(512, public_dir / 'pwa-512x512.png')
make_icon(180, public_dir / 'apple-touch-icon.png')
make_icon(512, public_dir / 'pwa-maskable-512x512.png', maskable=True)

print('Generated PWA icons in', public_dir)
