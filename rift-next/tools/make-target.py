"""Generate the fixed, high-contrast laptop image used for image tracking."""

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "target-source.png"
W, H = 960, 1280
PAPER = (232, 231, 214)
INK = (19, 24, 23)
MUTED = (88, 99, 90)
ACID = (213, 239, 68)


def font(size, bold=False):
    name = "seguisb.ttf" if bold else "consola.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


image = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(image)
rng = Random(90731)

# Asymmetric landmarks and several scales of detail make the same flat image
# useful for both recognition and visual alignment in the camera feed.
draw.rectangle((36, 36, 924, 1244), outline=INK, width=7)
draw.rectangle((62, 62, 898, 1218), outline=MUTED, width=2)
draw.rectangle((62, 62, 194, 191), fill=INK)
draw.polygon([(792, 62), (898, 62), (898, 223), (838, 188)], fill=INK)
draw.polygon([(62, 1092), (185, 1148), (215, 1218), (62, 1218)], fill=INK)
draw.rectangle((778, 1098, 898, 1218), fill=INK)
draw.rectangle((802, 1122, 874, 1194), fill=PAPER)
draw.line((802, 1194, 874, 1122), fill=INK, width=10)
draw.line((115, 104, 176, 163), fill=PAPER, width=13)
draw.line((176, 104, 115, 163), fill=PAPER, width=13)

draw.text((102, 252), "RIFT", font=font(172, True), fill=INK, stroke_width=1)
draw.text((109, 434), "SPATIAL / 01", font=font(42, True), fill=INK)
draw.rectangle((106, 512, 854, 528), fill=INK)
draw.rectangle((106, 527, 359, 548), fill=ACID)

# A lopsided chamber silhouette, with off-centre openings and cross-lines.
draw.polygon([(127, 626), (403, 574), (806, 616), (853, 900), (667, 1048),
              (326, 1029), (108, 880)], fill=INK)
draw.polygon([(188, 680), (442, 632), (736, 678), (789, 862), (637, 980),
              (354, 972), (178, 842)], fill=PAPER)
draw.polygon([(289, 720), (480, 675), (703, 742), (718, 841), (594, 924),
              (391, 902), (268, 811)], fill=INK)
draw.ellipse((409, 726, 593, 910), fill=PAPER)
draw.ellipse((459, 770, 549, 860), fill=INK)
draw.line((192, 841, 790, 701), fill=INK, width=9)
draw.line((252, 647, 652, 977), fill=INK, width=7)
draw.line((303, 967, 740, 721), fill=PAPER, width=9)

for idx in range(190):
    x = rng.randrange(94, 865)
    y = rng.choice((rng.randrange(203, 252), rng.randrange(559, 620),
                    rng.randrange(1053, 1103)))
    size = rng.randrange(3, 12)
    if idx % 5:
        draw.rectangle((x, y, x + size, y + size), fill=INK)
    else:
        draw.line((x, y, x + size * 2, y + size), fill=INK, width=3)

for idx, x in enumerate((246, 390, 545, 700)):
    draw.rectangle((x, 1151, x + 61, 1191), outline=INK, width=3)
    draw.line((x + 9, 1177, x + 21 + idx * 3, 1161), fill=INK, width=5)
draw.text((247, 1107), "TRACE  /  RF-90731", font=font(26), fill=INK)
draw.text((680, 227), "A-04", font=font(31, True), fill=INK)

OUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUT, optimize=True)
print(OUT)
