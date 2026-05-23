from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "public" / "images" / "hero-microscope-vetneb.webp"
OUTPUT_DIR = ROOT / "frontend" / "public" / "icons"

SIZES = {
    "icon-16x16.png": 16,
    "icon-32x32.png": 32,
    "apple-touch-icon.png": 180,
    "icon-192x192.png": 192,
    "icon-512x512.png": 512,
    "maskable-icon-192x192.png": 192,
    "maskable-icon-512x512.png": 512,
}

BACKGROUND = (12, 53, 78, 255)
ACCENT = (34, 174, 163, 255)
TEXT = (255, 255, 255, 255)


def crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def apply_overlay(image: Image.Image, size: int, maskable: bool) -> Image.Image:
    icon = image.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    overlay = Image.new("RGBA", (size, size), (8, 33, 49, 124))
    icon.alpha_composite(overlay)

    draw = ImageDraw.Draw(icon)
    safe_padding = int(size * (0.16 if maskable else 0.1))
    badge_size = int(size * (0.46 if maskable else 0.5))
    badge_left = size - safe_padding - badge_size
    badge_top = size - safe_padding - badge_size
    radius = int(badge_size * 0.22)

    draw.rounded_rectangle(
        (badge_left, badge_top, badge_left + badge_size, badge_top + badge_size),
        radius=radius,
        fill=BACKGROUND,
        outline=ACCENT,
        width=max(1, size // 64),
    )

    # Símbolo simple, legible y propio: monograma V con barra diagnóstica.
    stroke = max(2, size // 38)
    x1 = badge_left + int(badge_size * 0.22)
    y1 = badge_top + int(badge_size * 0.3)
    x2 = badge_left + int(badge_size * 0.5)
    y2 = badge_top + int(badge_size * 0.72)
    x3 = badge_left + int(badge_size * 0.78)
    draw.line((x1, y1, x2, y2, x3, y1), fill=TEXT, width=stroke, joint="curve")
    draw.line(
        (
            badge_left + int(badge_size * 0.25),
            badge_top + int(badge_size * 0.78),
            badge_left + int(badge_size * 0.75),
            badge_top + int(badge_size * 0.78),
        ),
        fill=ACCENT,
        width=max(1, stroke // 2),
    )

    return icon


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"No existe el asset fuente: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = crop_square(Image.open(SOURCE).convert("RGBA"))

    for filename, size in SIZES.items():
        icon = apply_overlay(source, size, filename.startswith("maskable"))
        icon.save(OUTPUT_DIR / filename, optimize=True)


if __name__ == "__main__":
    main()
