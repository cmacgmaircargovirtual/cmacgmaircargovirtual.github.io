"""Build the web images of the CMA CGM Air Cargo Virtual site from the source files of the project folder.

Usage:  python scripts/build_assets.py
Re-run whenever a source image changes. Source files are never modified.

Sources (project folder)
  Logo Black.png                           white "vCMA" on black
  vCMA Black.png                           white "vCMA" + "Delivering at the Highest Level" on black
  CMA CGM Air Cargo Virtual - Black.png    white "CMA CGM AIR CARGO VIRTUAL" on black

  Photos/ (Flickr, JetPhotos, Planespotters.net and Spot Youz, all rights reserved: credit the
           photographers, see PHOTOS_USED below; their signatures stay on the photos.
           Exception: the maintenance photo comes from Wikimedia Commons under CC BY-SA 2.0, which
           requires the credit, a link to the licence and a note of the changes, all shown on the page)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "Photos"
OUT = ROOT / "site" / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)

BLUE = (37, 99, 255)       # --blue of the site
RED = (255, 31, 45)        # --red
BLACK = (0, 0, 0)          # --black

# Photo id (start of the file name in Photos/) -> (photographer, subject).
# Keep in step with the credits in index.html and the table in README.md.
PHOTOS_USED = {
    "55613513424": ("Daniel Lapierre", "777F F-HMRF taking off, Paris-CDG"),  # hero
    "53569468759": ("Enzo Cattania", "777F F-HMRB, head-on"),                 # about, Open Graph
    "55451424799": ("Andrew Simpson", "777F N761GT, Anchorage"),              # fleet 777F
    "51843021548": ("Black Labrador13", "A330F OO-SEA, Brussels"),            # fleet A330
    "52448401251": ("Czirok Bence", "777F F-HMRF landing in the mist"),       # join
    "53323769502": ("Colin Cooke Photo", "A330-200F F-HMRG taking off, London Stansted"),  # maintenance page, CC BY-SA 2.0
}


def photo(photo_id: str) -> Image.Image:
    """Flickr and JetPhotos files start with their id; Planespotters files have it in the middle
    (registration-airline-type_PlanespottersNet_<id>_<hash>_o.jpg); Wikimedia Commons copies of Flickr
    photos end with it in brackets (Title_words_(<id>).jpg)."""
    found = (sorted(PHOTOS.glob(f"{photo_id}_*.jpg")) or sorted(PHOTOS.glob(f"*_{photo_id}_*.jpg"))
             or sorted(PHOTOS.glob(f"*({photo_id}).jpg")))
    return Image.open(found[0]).convert("RGB")


def crop_rel(img: Image.Image, x0: float, y0: float, x1: float, y1: float) -> Image.Image:
    w, h = img.size
    return img.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))


def crop_ratio(img: Image.Image, ratio: float, cy: float, cx: float = 0.5) -> Image.Image:
    """Largest crop of the given width/height ratio, centred on (cx, cy) in relative units."""
    w, h = img.size
    if w / h > ratio:
        cw, ch = round(h * ratio), h
    else:
        cw, ch = w, round(w / ratio)
    left = min(max(0, round(cx * w - cw / 2)), w - cw)
    top = min(max(0, round(cy * h - ch / 2)), h - ch)
    return img.crop((left, top, left + cw, top + ch))


def save_jpg(img: Image.Image, name: str, width: int, quality: int = 80) -> None:
    img = img.convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(OUT / name, "JPEG", quality=quality, optimize=True, progressive=True)


def white_on_black_to_alpha(path: Path) -> Image.Image:
    """White artwork on a black background -> white artwork on transparency, trimmed."""
    lum = Image.open(path).convert("L")
    alpha = lum.point(lambda v: 0 if v < 12 else min(255, round((v - 12) * 255 / 243)))
    art = Image.new("RGBA", lum.size, (255, 255, 255, 0))
    art.putalpha(alpha)
    return art.crop(alpha.getbbox())


def save_logo(img: Image.Image, name: str, width: int) -> None:
    img = img.copy()
    img.thumbnail((width, width), Image.LANCZOS)
    img.save(OUT / name, optimize=True)


def tricolour(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    third = (x1 - x0) / 3
    for i, colour in enumerate((BLUE, (255, 255, 255), RED)):
        draw.rectangle([round(x0 + i * third), y0, round(x0 + (i + 1) * third), y1], fill=colour)


def fade_to_black(img: Image.Image, top: float = 0.0, bottom: float = 0.0) -> Image.Image:
    """Vertical fades to black: `top` and `bottom` are the share of the height they cover."""
    img = img.convert("RGBA")
    w, h = img.size
    mask = Image.new("L", (1, h), 0)
    px = mask.load()
    for y in range(h):
        a = 0.0
        if top and y < h * top:
            a = max(a, 1 - y / (h * top))
        if bottom and y > h * (1 - bottom):
            a = max(a, (y - h * (1 - bottom)) / (h * bottom))
        px[0, y] = round(255 * min(1.0, a) ** 1.4)
    mask = mask.resize((w, h))
    return Image.composite(Image.new("RGBA", (w, h), (*BLACK, 255)), img, mask)


# 1. Logos: white, on transparency (they sit on the black of the site) ---------------------
mark = white_on_black_to_alpha(ROOT / "Logo Black.png")
save_logo(mark, "logo-vcma.png", 640)
save_logo(white_on_black_to_alpha(ROOT / "vCMA Black.png"), "logo-lockup.png", 900)
wordmark = white_on_black_to_alpha(ROOT / "CMA CGM Air Cargo Virtual - Black.png")
save_logo(wordmark, "logo-wordmark.png", 1000)

# 2. Favicons: white vCMA on black over a thin tricolour line ------------------------------
for size, name in ((180, "apple-touch-icon.png"), (64, "favicon-64.png"), (32, "favicon-32.png")):
    icon = Image.new("RGBA", (size, size), (*BLACK, 255))
    logo = mark.copy()
    logo.thumbnail((round(size * 0.84), size), Image.LANCZOS)
    icon.alpha_composite(logo, ((size - logo.width) // 2, round(size * 0.45 - logo.height / 2)))
    bar = max(2, round(size * 0.05))
    tricolour(ImageDraw.Draw(icon), (round(size * 0.2), round(size * 0.74), round(size * 0.8), round(size * 0.74) + bar))
    icon.save(OUT / name, optimize=True)

# 3. Photos ---------------------------------------------------------------------------------
# Hero: the 777F F-HMRF taking off from Paris-CDG, Air France tails behind, by Daniel Lapierre.
# The photo sits in a band at the top of the screen (the title is below it, on black), so the whole
# aircraft stays visible. The share of the height where the aircraft ends is used in style.css
# (--plane-bottom): change it there whenever a crop below changes.
#   desktop  2.1:1, whole width (2048 px, the full file)   top of the aircraft 15 %, main gear 65 %
#   tablet   16:9, the bottom of the frame                  top 19 %, gear 62 %
#   phone    4:3 on the front half (nose, titles, gear)     top 27 % (clear of the menu bar), gear 74 %
takeoff = photo("55613513424")
save_jpg(crop_ratio(takeoff, 2.1, cy=0.57), "hero-desktop.jpg", 2048, quality=82)
save_jpg(crop_ratio(takeoff, 16 / 9, cy=1.0), "hero-tablet.jpg", 1400, quality=82)
save_jpg(takeoff.crop((648, 150, 2048, 1200)), "hero-mobile.jpg", 900, quality=82)

# About ("Home of the fleet"): the 777F head-on, whole frame.
head_on = photo("53569468759")
save_jpg(head_on, "about-fleet.jpg", 1600, quality=80)

# Fleet cards, 3:2.
save_jpg(crop_ratio(photo("55451424799"), 1.5, cy=0.5), "fleet-777f.jpg", 1400, quality=80)
save_jpg(crop_ratio(photo("51843021548"), 1.5, cy=0.5), "fleet-a330.jpg", 1400, quality=80)

# Join background: the 777F F-HMRF landing in the mist, by Czirok Bence.
# Full width of the file (1880 px): the section spans the whole screen.
mist = photo("52448401251")
save_jpg(mist, "join.jpg", 1880, quality=76)

# Maintenance page: the A330-200F F-HMRG taking off from Stansted at sunset, by Colin Cooke Photo (CC BY-SA 2.0).
# Whole 3:2 frame, only resized: the page shows a full-width band of it, and the aircraft (tail top 38 %,
# main gear 75 % of the height, 2 % to 97 % of the width) stays whole at every screen shape.
save_jpg(photo("53323769502"), "maintenance.jpg", 2400, quality=78)

# 4. Open Graph / Discord preview card, 1200 x 630 ------------------------------------------
og_w, og_h, band = 1200, 630, 170
og = Image.new("RGBA", (og_w, og_h), (*BLACK, 255))
pic = crop_ratio(head_on, og_w / (og_h - band + 40), cy=0.55).resize((og_w, og_h - band + 40), Image.LANCZOS)
og.alpha_composite(fade_to_black(pic, top=0.12, bottom=0.3), (0, 0))
logo = wordmark.copy()
logo.thumbnail((640, 640), Image.LANCZOS)
og.alpha_composite(logo, ((og_w - logo.width) // 2, og_h - band // 2 - logo.height // 2 - 4))
tricolour(ImageDraw.Draw(og), (0, og_h - 6, og_w, og_h))
og.convert("RGB").save(OUT / "og-image.jpg", "JPEG", quality=85, optimize=True, progressive=True)

# 5. Old files no longer used ---------------------------------------------------------------
for old in ("ramp-night.jpg", "ramp-tails.jpg", "hero-1900.jpg", "hero-1200.jpg",
            "hero-2400.jpg", "hero-1400.jpg", "about-cdg.jpg", "join-storm.jpg"):
    (OUT / old).unlink(missing_ok=True)

for f in sorted(OUT.iterdir()):
    print(f"{f.name:24} {f.stat().st_size // 1024:>5} KB")
