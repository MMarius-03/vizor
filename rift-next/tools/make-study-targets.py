"""Render the ATLAS and ORBIT laptop posters and their image-tracking targets."""

from datetime import datetime, timezone
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TARGETS = ROOT / "target-data"
W, H = 960, 1280


def font(size, bold=False, mono=False):
    if mono:
        names = ("consola.ttf", "C:/Windows/Fonts/consola.ttf")
    elif bold:
        names = ("C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arialbd.ttf")
    else:
        names = ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf")
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def frame(draw, bg, ink, accent):
    draw.rectangle((34, 34, 926, 1246), outline=ink, width=7)
    draw.rectangle((57, 57, 903, 1223), outline=accent, width=2)
    draw.rectangle((57, 57, 165, 165), fill=ink)
    draw.line((83, 83, 139, 139), fill=bg, width=12)
    draw.line((139, 83, 83, 139), fill=bg, width=12)
    for x, y, dx, dy in ((903, 57, -92, 126), (57, 1223, 130, -66)):
        draw.polygon(((x, y), (x + dx, y), (x, y + dy)), fill=ink)


def atlas():
    bg, ink, muted, accent = (237, 228, 210), (29, 35, 32), (83, 87, 78), (195, 96, 66)
    image = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(image)
    frame(draw, bg, ink, accent)
    draw.text((188, 78), "ATLAS", font=font(87, True), fill=ink)
    draw.text((194, 170), "ORAS IN MINIATURA  /  02", font=font(24, True, True), fill=muted)
    draw.text((756, 96), "A-02", font=font(30, True, True), fill=accent)
    draw.rectangle((115, 237, 845, 250), fill=ink)
    draw.rectangle((115, 250, 368, 270), fill=accent)

    # A compact street plan fills the upper field and gives tracking details
    # across the whole poster instead of concentrating them around the model.
    draw.text((125, 307), "PLAN / DISTRICT 04", font=font(18, True, True), fill=accent)
    draw.rectangle((123, 337, 837, 503), outline=muted, width=3)
    for y in (374, 430, 483):
        draw.line((132, y, 828, y), fill=(153, 147, 130), width=11)
        draw.line((132, y, 828, y), fill=bg, width=3)
    for x in (235, 349, 466, 579, 696, 804):
        draw.line((x, 345, x, 495), fill=(153, 147, 130), width=10)
        draw.line((x, 345, x, 495), fill=bg, width=3)
    parcels = ((146, 347, 214, 365), (250, 385, 328, 422), (365, 344, 445, 366),
               (484, 389, 559, 422), (597, 345, 677, 365), (715, 441, 787, 472),
               (146, 441, 216, 472), (365, 446, 446, 472), (598, 445, 679, 472))
    for x1, y1, x2, y2 in parcels:
        draw.rectangle((x1, y1, x2, y2), fill=(209, 198, 177), outline=ink, width=3)
        draw.line((x1+8, y1+7, x2-8, y1+7), fill=accent, width=3)

    # Topographic island with a winding river separating it from the blocks.
    draw.polygon(((117, 773), (202, 708), (325, 680), (453, 704), (574, 666),
                  (727, 712), (846, 776), (821, 947), (704, 1018), (534, 1040),
                  (354, 1020), (190, 960), (112, 877)), fill=(202, 193, 174), outline=ink, width=7)
    for inset in (20, 41):
        draw.line(((144+inset, 805+inset//2), (272, 736+inset//3), (399, 750),
                   (531, 710+inset//4), (691, 756), (812-inset//2, 801+inset//2)), fill=muted, width=3)
    river = ((150, 886), (250, 857), (310, 806), (413, 812), (492, 869),
             (609, 875), (692, 823), (799, 846))
    draw.line(river, fill=(79, 111, 119), width=47, joint="curve")
    draw.line(river, fill=(207, 221, 213), width=5, joint="curve")

    # Varied building silhouettes make a detailed, unmistakable image target.
    buildings = [
        (230, 608, 315, 754, (105, 111, 103), 0), (334, 557, 432, 763, accent, 1),
        (461, 620, 540, 768, (164, 153, 132), 0), (562, 584, 646, 758, (77, 85, 81), 2),
        (674, 640, 744, 775, (172, 118, 89), 0), (173, 695, 218, 776, (125, 123, 108), 0),
        (758, 705, 801, 801, (102, 108, 102), 0),
    ]
    for x1, y1, x2, y2, color, kind in buildings:
        draw.rectangle((x1, y1, x2, y2), fill=color, outline=ink, width=5)
        draw.polygon(((x1, y1), (x1+14, y1-16), (x2+14, y1-16), (x2, y1)), fill=(219, 209, 189), outline=ink)
        draw.polygon(((x2, y1), (x2+14, y1-16), (x2+14, y2-15), (x2, y2)), fill=(71, 74, 68), outline=ink)
        for wy in range(y1 + 28, y2 - 14, 35):
            draw.line((x1+15, wy, x2-12, wy), fill=bg, width=5)
        if kind == 1:
            draw.rectangle((x1+32, y1+27, x2-20, y2-8), outline=(244, 210, 180), width=4)
            draw.line((x1+42, y1+36, x1+42, y2-14), fill=(244, 210, 180), width=4)
        if kind == 2:
            draw.rectangle((x1+14, y1+18, x2-14, y1+36), fill=accent)

    for x, y, label in ((126, 556, "RIVER"), (656, 533, "NORTH"), (126, 1080, "TOPOGRAPHY / 3 LEVELS")):
        draw.text((x, y), label, font=font(20, True, True), fill=accent if y != 1080 else ink)
    draw.text((125, 1143), "RIFT  /  URBAN STUDY", font=font(22, True, True), fill=ink)
    draw.text((710, 1143), "37.6 N", font=font(22, True, True), fill=accent)
    for x in range(210, 845, 42):
        draw.line((x, 1097, x, 1110 if x % 3 else 1118), fill=muted, width=3)
    return image


def orbit():
    bg, ink, pale, accent = (18, 26, 39), (220, 229, 235), (122, 145, 165), (92, 137, 199)
    image = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(image)
    frame(draw, bg, ink, accent)
    draw.text((188, 78), "ORBIT", font=font(87, True), fill=pale)
    draw.text((194, 170), "INSTRUMENT KINETIC  /  03", font=font(24, True, True), fill=muted if False else (143, 161, 177))
    draw.text((756, 96), "O-03", font=font(30, True, True), fill=accent)
    draw.rectangle((115, 237, 845, 250), fill=pale)
    draw.rectangle((115, 250, 368, 270), fill=accent)

    cx, cy = 482, 713
    for r, color, width in ((280, pale, 6), (246, accent, 7), (204, (89, 113, 138), 4), (151, pale, 4), (79, accent, 5)):
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), outline=color, width=width)
    draw.ellipse((cx-280, cy-133, cx+280, cy+133), outline=accent, width=13)
    draw.ellipse((cx-110, cy-280, cx+110, cy+280), outline=(152, 178, 201), width=12)
    draw.ellipse((cx-239, cy-145, cx+239, cy+145), outline=pale, width=8)
    # Calibrated axes, hubs and high-contrast index marks.
    draw.line((cx, cy-322, cx, cy+322), fill=(92, 109, 126), width=3)
    draw.line((cx-322, cy, cx+322, cy), fill=(92, 109, 126), width=3)
    draw.line((cx-194, cy-194, cx+194, cy+194), fill=(92, 109, 126), width=3)
    for angle, label in ((-90, "01"), (30, "02"), (150, "03")):
        import math
        rad = math.radians(angle)
        x, y = cx + int(260 * math.cos(rad)), cy + int(260 * math.sin(rad))
        draw.ellipse((x-27, y-27, x+27, y+27), fill=accent, outline=pale, width=6)
        draw.ellipse((x-8, y-8, x+8, y+8), fill=bg)
        tx, ty = cx + int(340 * math.cos(rad)), cy + int(340 * math.sin(rad))
        draw.text((tx-20, ty-12), label, font=font(22, True, True), fill=pale)
    draw.ellipse((cx-92, cy-92, cx+92, cy+92), fill=accent, outline=pale, width=8)
    draw.ellipse((cx-44, cy-44, cx+44, cy+44), fill=bg, outline=pale, width=6)
    draw.ellipse((cx-13, cy-13, cx+13, cy+13), fill=pale)
    for r in range(309, 365, 18):
        for angle in range(0, 360, 12):
            import math
            rad = math.radians(angle)
            x1, y1 = cx + int(r * math.cos(rad)), cy + int(r * math.sin(rad))
            length = 16 if angle % 36 == 0 else 8
            x2, y2 = cx + int((r+length) * math.cos(rad)), cy + int((r+length) * math.sin(rad))
            draw.line((x1, y1, x2, y2), fill=accent if angle % 36 == 0 else (102, 122, 143), width=3)
    draw.text((120, 1114), "RIFT / CALIBRATION STUDY", font=font(22, True, True), fill=pale)
    draw.text((720, 1114), "AXIS 120 DEG", font=font(19, True, True), fill=accent)
    return image


def write_target(name, poster):
    TARGETS.mkdir(parents=True, exist_ok=True)
    original = TARGETS / f"{name}_original.png"
    cropped = TARGETS / f"{name}_cropped.png"
    thumbnail = TARGETS / f"{name}_thumbnail.png"
    luminance = TARGETS / f"{name}_luminance.png"
    poster.save(original, optimize=True)
    poster.save(cropped, optimize=True)
    poster.resize((263, 350), Image.Resampling.LANCZOS).save(thumbnail, optimize=True)
    poster.convert("L").resize((480, 640), Image.Resampling.LANCZOS).convert("RGB").save(luminance, optimize=True)
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    data = {
        "imagePath": f"./target-data/{name}_luminance.png", "metadata": None,
        "name": name, "type": "PLANAR",
        "properties": {"left": 0, "top": 0, "width": W, "height": H, "isRotated": False,
                       "originalWidth": W, "originalHeight": H},
        "resources": {"originalImage": original.name, "croppedImage": cropped.name,
                      "thumbnailImage": thumbnail.name, "luminanceImage": luminance.name},
        "created": now, "updated": now,
    }
    (TARGETS / f"{name}.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


write_target("atlas-screen", atlas())
write_target("orbit-screen", orbit())
print("Generated ATLAS and ORBIT image targets.")
