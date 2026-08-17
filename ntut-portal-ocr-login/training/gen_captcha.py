"""Synthetic NTUT nportal captcha generator.
Replicates: 135x39, solid pastel bg, 4 rotated saturated uppercase letters,
2-4 crossing straight lines, ~10-20 star/plus speckles.
Charset: uppercase A-Z (confirmed via visual sampling).
"""
import random, colorsys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 135, 39
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FONTS = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Verdana.ttf",
    "/System/Library/Fonts/Supplemental/Tahoma.ttf",
    "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
_font_cache = {}
def _font(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]

def _pastel_bg():
    # high-value light color; one channel near 255 like the real distribution
    ch = [random.randint(155, 255) for _ in range(3)]
    ch[random.randint(0, 2)] = 255
    return tuple(ch)

def _sat_color():
    # vivid but with varying value (some letters lighter)
    h = random.random()
    s = random.uniform(0.45, 0.9)
    v = random.uniform(0.45, 0.9)
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r*255), int(g*255), int(b*255))

def _draw_star(d, x, y, size, color):
    # 4-point plus/star speckle
    if random.random() < 0.5:
        d.line([(x-size, y), (x+size, y)], fill=color, width=1)
        d.line([(x, y-size), (x, y+size)], fill=color, width=1)
    else:
        d.line([(x-size, y-size), (x+size, y+size)], fill=color, width=1)
        d.line([(x-size, y+size), (x+size, y-size)], fill=color, width=1)

def generate():
    label = "".join(random.choice(CHARS) for _ in range(4))
    img = Image.new("RGB", (W, H), _pastel_bg())
    dl = ImageDraw.Draw(img)
    # some pale wide translucent-looking bands drawn UNDER the letters (like real)
    for _ in range(random.randint(0, 2)):
        col = tuple(random.randint(180, 245) for _ in range(3))
        y1, y2 = random.randint(0, H), random.randint(0, H)
        dl.line([(random.randint(-10, 15), y1), (random.randint(W-15, W+10), y2)],
                fill=col, width=random.randint(3, 6))
    # letters: 4 slots spanning the width, with strong positional augmentation so the
    # model learns glyph shape, not absolute slot position.
    margin = random.randint(9, 20)
    step = (W - 2*margin) / 3.0
    gx = random.randint(-5, 5)                     # global horizontal shift
    for i, ch in enumerate(label):
        size = random.randint(28, 36)
        font = _font(random.choice(FONTS), size)
        tmp = Image.new("RGBA", (60, 60), (0, 0, 0, 0))
        td = ImageDraw.Draw(tmp)
        bbox = td.textbbox((0, 0), ch, font=font)
        gw, gh = bbox[2]-bbox[0], bbox[3]-bbox[1]
        layer = Image.new("RGBA", (gw+8, gh+8), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((4-bbox[0], 4-bbox[1]), ch, font=font, fill=_sat_color()+(255,))
        layer = layer.rotate(random.uniform(-30, 30), expand=True, resample=Image.BICUBIC)
        cx = margin + step*i + gx + random.randint(-7, 7)
        x = int(cx - layer.width/2)
        y = (H-layer.height)//2 + random.randint(-4, 4)
        img.paste(layer, (x, y), layer)
    d = ImageDraw.Draw(img)
    # crossing straight lines (over letters), mixed saturated + pale, varied width
    for _ in range(random.randint(2, 5)):
        col = _sat_color() if random.random() < 0.5 else tuple(random.randint(150, 240) for _ in range(3))
        y1, y2 = random.randint(0, H), random.randint(0, H)
        d.line([(random.randint(-10, 20), y1), (random.randint(W-20, W+10), y2)],
               fill=col, width=random.randint(1, 3))
    # star speckles
    for _ in range(random.randint(8, 22)):
        _draw_star(d, random.randint(0, W), random.randint(0, H),
                   random.randint(1, 2), _sat_color())
    # slight blur + brightness jitter (real images are softly anti-aliased)
    if random.random() < 0.5:
        img = img.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 0.8)))
    return img, label

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "synth_preview.png"
    n = 8
    rows = []
    for _ in range(n):
        im, lab = generate()
        rows.append((im, lab))
    scale = 3
    sheet = Image.new("RGB", (W*scale, (H*scale+16)*n), (255, 255, 255))
    dd = ImageDraw.Draw(sheet)
    for i, (im, lab) in enumerate(rows):
        sheet.paste(im.resize((W*scale, H*scale), Image.LANCZOS), (0, i*(H*scale+16)+14))
        dd.text((2, i*(H*scale+16)), lab, fill=(200, 0, 0))
    sheet.save(out)
    print(out)
