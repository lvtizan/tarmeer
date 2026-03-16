from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
COVER_DIR = ROOT_DIR / "public" / "images" / "designers" / "projects" / "covers"
DETAIL_DIR = ROOT_DIR / "public" / "images" / "designers" / "projects" / "details-v2"

DETAIL_DIR.mkdir(parents=True, exist_ok=True)


def build_variants(image_path: Path) -> None:
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    crop_width = int(width * 0.92)
    crop_height = int(height * 0.92)

    offsets = [
        (0, 0),
        (max(0, width - crop_width) // 2, max(0, height - crop_height) // 2),
        (max(0, width - crop_width), max(0, height - crop_height)),
    ]

    for variant_index, (left, top) in enumerate(offsets, start=1):
        cropped = image.crop((left, top, left + crop_width, top + crop_height))
        resized = cropped.resize((width, height), Image.Resampling.LANCZOS)
        out_path = DETAIL_DIR / f"{image_path.stem}-{variant_index}.jpg"
        resized.save(out_path, quality=90, optimize=True)


for cover_file in sorted(COVER_DIR.glob("cover-*.jpg")):
    build_variants(cover_file)

print(f"Generated {len(list(DETAIL_DIR.glob('*.jpg')))} unique project detail files in {DETAIL_DIR}")
