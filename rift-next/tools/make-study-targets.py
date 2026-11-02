"""Render the ATLAS and ORBIT laptop posters and their image-tracking targets."""

from datetime import datetime, timezone
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TARGETS = ROOT / "target-data"
W, H = 960, 1280
LAYOUT = json.loads((ROOT / "studies" / "campus-layout.json").read_text(encoding="utf-8"))


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
    paper, ink, blue, grass = (248, 248, 243), (24, 42, 57), (36, 111, 179), (216, 237, 139)
    image = Image.new('RGB',(W,H),paper)
    draw = ImageDraw.Draw(image)
    frame(draw,paper,ink,blue)
    draw.text((191,76),'ATLAS',font=font(84,True),fill=ink)
    draw.text((195,166),'CAMPUS USV / 02',font=font(25,True,True),fill=blue)
    draw.rectangle((112,238,850,254),fill=ink)
    draw.rectangle((112,254,382,269),fill=grass)
    draw.text((119,304),'PLANUL CAMPUSULUI',font=font(25,True,True),fill=ink)
    box=(105,345,855,974)
    draw.rectangle(box,fill=(250,250,245),outline=ink,width=3)
    def pt(point):
        return (int(box[0]+point[0]*(box[2]-box[0])/1000),
                int(box[1]+point[1]*(box[3]-box[1])/1000))
    for polygon in LAYOUT['greens']:
        draw.polygon([pt(p) for p in polygon],fill=grass)
    for item in LAYOUT['paths']:
        draw.line([pt(p) for p in item['points']],fill=paper,width=max(5,int(item['width']*.67)),joint='curve')
    fx1,fy1,fx2,fy2=LAYOUT['sportField']
    draw.rectangle((*pt((fx1,fy1)),*pt((fx2,fy2))),fill=(198,227,123),outline=(169,197,91),width=3)
    cx,cy=pt(LAYOUT['park']['center'])
    radius=int(LAYOUT['park']['radius']*.68)
    draw.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill=paper,outline=grass,width=6)
    draw.ellipse((cx-8,cy-8,cx+8,cy+8),fill=grass)
    label_positions={'A':(768,579),'D':(783,370),'E':(560,748),'CĂMIN 1':(475,614),'CĂMIN 2':(457,453)}
    for building in LAYOUT['buildings']:
        points=[pt(p) for p in building['points']]
        draw.polygon(points,fill=(219,222,218) if building.get('neutral') else (170,213,242),
                     outline=(153,159,159) if building.get('neutral') else (28,104,188),width=5)
        for hole in building.get('holes',[]):
            draw.polygon([pt(p) for p in hole],fill=paper,outline=blue,width=3)
        ident=building['id']
        if ident in label_positions:
            pos=label_positions[ident]
        else:
            pos=(sum(p[0] for p in building['points'])/len(points),
                 sum(p[1] for p in building['points'])/len(points))
        if ident in ('A','B','C','D','E','F','G','H','J','N'):
            draw.text(pt(pos),ident,anchor='mm',font=font(30,True),fill=(25,60,113))
    draw.text((119,1002),'CORPURI / CĂMINE / PARC',font=font(22,True,True),fill=ink)
    draw.text((120,1150),'RIFT / CAMPUS STUDY',font=font(22,True,True),fill=blue)
    draw.text((743,1150),'SCAN 02',font=font(20,True,True),fill=ink)
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


(ROOT / "studies" / "campus-layout.js").write_text(
    "export const campusLayout = " + json.dumps(LAYOUT, ensure_ascii=False, separators=(',',':')) + ";\n",
    encoding="utf-8")
write_target("atlas-screen", atlas())
write_target("orbit-screen", orbit())
print("Generated ATLAS and ORBIT image targets.")
