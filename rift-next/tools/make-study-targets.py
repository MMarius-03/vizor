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
    paper, ink, blue, green, orange = (244, 244, 237), (24, 39, 50), (16, 85, 144), (170, 207, 69), (239, 153, 37)
    image = Image.new('RGB', (W, H), paper)
    draw = ImageDraw.Draw(image)
    frame(draw, paper, ink, blue)
    draw.text((190, 75), 'ATLAS', font=font(84, True), fill=ink)
    draw.text((195, 165), 'CAMPUS / 02', font=font(26, True, True), fill=blue)
    draw.text((715, 104), 'USV', font=font(30, True, True), fill=blue)
    draw.rectangle((112, 236, 850, 252), fill=ink)
    draw.rectangle((112, 252, 378, 268), fill=green)
    draw.text((118, 307), 'PLANUL CAMPUSULUI', font=font(26, True, True), fill=ink)

    # The 3D model uses the same relative footprint positions as this plan.
    x0, y0, sx, sy = 480, 697, 222, 294
    def point(x, y):
        return (int(x0 + x * sx), int(y0 - y * sy))
    draw.rectangle((112, 346, 850, 1072), fill=(210, 224, 177), outline=ink, width=4)
    for x, y, w, h in ((1.13, .71, .62, .56), (-1.15, .68, .66, .54), (.24, -.85, .63, .36), (-.94, -.87, .6, .31)):
        cx, cy = point(x, y)
        draw.rectangle((int(cx-w*sx/2), int(cy-h*sy/2), int(cx+w*sx/2), int(cy+h*sy/2)), fill=(174, 208, 83))
    for x in (-.59, -.02, .63):
        px, _ = point(x, 0)
        draw.line((px, 366, px, 1050), fill=paper, width=22)
        draw.line((px, 366, px, 1050), fill=(185, 190, 180), width=2)
    for y in (.31, -.38):
        _, py = point(0, y)
        draw.line((127, py, 836, py), fill=paper, width=25)
        draw.line((127, py, 836, py), fill=(185, 190, 180), width=2)
    cx, cy = point(.3, -.1)
    draw.ellipse((cx-38, cy-38, cx+38, cy+38), fill=paper, outline=(176, 184, 176), width=3)
    blocks = [
        ('A', .25, .47, .71, .34), ('B', -1.05, -.73, .66, .28),
        ('C', -1.17, -.26, .51, .24), ('D', -.87, .56, .39, .49),
        ('E', 1.09, -.12, .49, .55), ('F', -.46, .84, .25, .29),
        ('G', -.99, 1.0, .27, .17), ('H', .87, .94, .28, .2),
        ('J', -1.42, .96, .17, .19), ('L', -.25, -.09, .36, .34),
        ('M', 1.43, .66, .21, .19),
    ]
    for letter, x, y, w, h in blocks:
        cx, cy = point(x, y)
        box = (int(cx-w*sx/2), int(cy-h*sy/2), int(cx+w*sx/2), int(cy+h*sy/2))
        draw.rectangle(box, fill=blue, outline=(6, 49, 88), width=5)
        draw.line((box[0]+7, box[1]+7, box[2]-7, box[1]+7), fill=(113, 179, 219), width=4)
        draw.text((cx, cy), letter, anchor='mm', font=font(31 if w > .3 else 22, True), fill=paper)
    for number, x, y in ((1, -.45, .41), (2, .91, -.58), (3, -.98, -.54), (4, .46, .79), (5, -.72, .86)):
        cx, cy = point(x, y)
        draw.ellipse((cx-16, cy-16, cx+16, cy+16), fill=orange, outline=ink, width=3)
        draw.text((cx, cy), str(number), anchor='mm', font=font(17, True), fill=ink)
    draw.text((128, 1102), 'CORPURI  /  ALEI  /  CURTI VERZI', font=font(20, True, True), fill=ink)
    draw.text((128, 1151), 'RIFT / CAMPUS STUDY', font=font(22, True, True), fill=blue)
    draw.text((736, 1151), 'SCAN 02', font=font(20, True, True), fill=ink)
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
    json_path = TARGETS / f"{name}.json"
    previous = json.loads(json_path.read_text(encoding="utf-8")) if json_path.exists() else {}
    original = TARGETS / f"{name}_original.png"
    cropped = TARGETS / f"{name}_cropped.png"
    thumbnail = TARGETS / f"{name}_thumbnail.png"
    luminance = TARGETS / f"{name}_luminance.png"
    old_luminance = luminance.read_bytes() if luminance.exists() else None
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
        "created": previous.get("created", now),
        "updated": previous.get("updated", now) if old_luminance == luminance.read_bytes() else now,
    }
    json_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


write_target("atlas-screen", atlas())
write_target("orbit-screen", orbit())
print("Generated ATLAS and ORBIT image targets.")
