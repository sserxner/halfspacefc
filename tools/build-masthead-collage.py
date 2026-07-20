from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets" / "halfspace-masthead-v1.png"
OUT = ROOT / "output" / "masthead-collage-v2.png"
LAYERS = ROOT / "output" / "masthead-layers-v2"

DARK = "#061f14"
GOLD = "#c99b47"


def source_cutout(path, points, name, target_width, x, y):
    image = Image.open(path).convert("RGBA")
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.4))
    alpha = Image.eval(mask, lambda value: 0 if value < 20 else value)

    gray = ImageOps.grayscale(image)
    gray = ImageEnhance.Contrast(gray).enhance(1.22)
    toned = ImageOps.colorize(gray, DARK, GOLD).convert("RGBA")
    toned.putalpha(alpha)

    bbox = toned.getbbox()
    toned = toned.crop(bbox)
    ratio = target_width / toned.width
    toned = toned.resize(
        (target_width, max(1, round(toned.height * ratio))),
        Image.Resampling.LANCZOS,
    )
    toned.save(LAYERS / f"{name}.png")
    return toned, (x, y)


def face_patch(path, box, size, name, x, y):
    image = Image.open(path).convert("RGBA").crop(box)
    image = image.resize(size, Image.Resampling.LANCZOS)
    gray = ImageEnhance.Contrast(ImageOps.grayscale(image)).enhance(1.18)
    toned = ImageOps.colorize(gray, DARK, GOLD).convert("RGBA")

    mask = Image.new("L", size, 0)
    inset_x = max(1, size[0] // 12)
    inset_y = max(1, size[1] // 14)
    ImageDraw.Draw(mask).ellipse(
        (inset_x, inset_y, size[0] - inset_x, size[1] - inset_y),
        fill=238,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(max(2, size[0] // 10)))
    toned.putalpha(mask)
    toned.save(LAYERS / f"{name}.png")
    return toned, (x, y)


def main():
    LAYERS.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas = Image.open(BASE).convert("RGBA")

    additions = [
        source_cutout(
            "/Users/sserxner/Desktop/on-this-day-in-2009-andrey-arshavin-scored-four-goals-as-v0-MzHzROPQPVJdyJBlvsspEHqUmR-DQAIvRIldGU8P498-1.webp",
            [
                (231, 616), (177, 586), (137, 537), (143, 482), (178, 440),
                (201, 398), (211, 339), (214, 281), (214, 225), (204, 172),
                (210, 105), (222, 48), (244, 16), (274, 6), (306, 15),
                (326, 51), (344, 91), (364, 124), (389, 154), (418, 179),
                (440, 219), (461, 267), (486, 323), (496, 367), (479, 391),
                (449, 368), (426, 339), (402, 318), (390, 368), (382, 420),
                (371, 467), (358, 519), (344, 574), (325, 622), (288, 636),
            ],
            "addition-four-fingers",
            128,
            1455,
            74,
        ),
        source_cutout(
            "/Users/sserxner/Desktop/paul-pogba-juventus-midfielder_3302303.jpg",
            [
                (340, 675), (382, 626), (419, 578), (450, 522), (469, 461),
                (481, 392), (459, 342), (421, 291), (386, 241), (395, 179),
                (440, 118), (507, 78), (581, 74), (635, 101), (671, 145),
                (710, 194), (761, 222), (831, 244), (920, 268), (1037, 294),
                (1191, 333), (1340, 374), (1465, 408), (1565, 444),
                (1592, 493), (1541, 519), (1450, 500), (1348, 470),
                (1212, 436), (1080, 407), (952, 382), (852, 367), (779, 386),
                (738, 442), (714, 510), (685, 585), (648, 668), (601, 751),
                (535, 831), (462, 868), (397, 837), (354, 774),
            ],
            "addition-hand-to-ear",
            146,
            570,
            80,
        ),
        source_cutout(
            "/Users/sserxner/Desktop/images.jpg",
            [
                (130, 505), (148, 449), (168, 397), (184, 345), (187, 291),
                (177, 235), (185, 180), (204, 125), (232, 70), (268, 27),
                (303, 16), (332, 28), (350, 63), (357, 100), (375, 137),
                (400, 176), (416, 222), (405, 261), (380, 285), (374, 330),
                (386, 381), (371, 426), (347, 474), (320, 530), (267, 548),
                (211, 542), (164, 529),
            ],
            "addition-jumping-red",
            132,
            850,
            58,
        ),
        source_cutout(
            "/Users/sserxner/Desktop/dempsey.webp",
            [
                (74, 968), (171, 841), (281, 727), (402, 620), (558, 530),
                (722, 446), (834, 357), (918, 229), (1017, 120), (1110, 83),
                (1195, 94), (1275, 135), (1333, 211), (1398, 309),
                (1520, 377), (1663, 447), (1814, 533), (1950, 617),
                (2027, 713), (1982, 793), (1871, 777), (1755, 716),
                (1626, 648), (1493, 596), (1398, 616), (1346, 699),
                (1312, 811), (1274, 961), (1212, 1117), (1110, 1292),
                (985, 1367), (845, 1348), (751, 1245), (682, 1108),
                (615, 954), (493, 886), (350, 906), (214, 975),
            ],
            "addition-arms-out",
            168,
            1180,
            74,
        ),
        source_cutout(
            "/Users/sserxner/Desktop/messi-lamine-yamal-foto-barcelona-nss-3_v2.webp",
            [
                (62, 760), (42, 695), (61, 629), (107, 576), (157, 522),
                (178, 451), (176, 373), (190, 285), (220, 193), (274, 104),
                (348, 48), (430, 17), (514, 31), (577, 83), (626, 154),
                (650, 244), (690, 340), (749, 419), (786, 510), (787, 610),
                (757, 711), (717, 789), (632, 819), (526, 829), (412, 823),
                (300, 817), (189, 808), (102, 794),
            ],
            "addition-bath",
            164,
            1004,
            12,
        ),
    ]
    for layer, position in additions:
        canvas.alpha_composite(layer, position)

    repairs = [
        face_patch(
            "/Users/sserxner/.Trash/article-1356508-0D279257000005DC-307_306x474.jpg",
            (82, 31, 164, 115), (47, 49), "repair-far-left", 184, 149,
        ),
        face_patch(
            "/Users/sserxner/.Trash/images 5.05.48 AM.jpg",
            (103, 77, 196, 172), (52, 55), "repair-left-adjacent", 383, 177,
        ),
        face_patch(
            "/Users/sserxner/.Trash/4030.webp",
            (681, 28, 868, 221), (54, 57), "repair-shooter", 1658, 25,
        ),
        face_patch(
            "/Users/sserxner/.Trash/4188.avif",
            (184, 93, 285, 192), (47, 48), "repair-knee-slide", 787, 105,
        ),
        face_patch(
            "/Users/sserxner/Desktop/w640xh480_REU_2307446.jpg",
            (215, 168, 349, 304), (53, 55), "repair-manager-left", 96, 24,
        ),
        face_patch(
            "/Users/sserxner/.Trash/453552799U.avif",
            (587, 164, 723, 301), (51, 52), "repair-left-striker", 489, 46,
        ),
        face_patch(
            "/Users/sserxner/.Trash/2129.webp",
            (488, 118, 687, 315), (57, 59), "repair-manager-right", 1990, 22,
        ),
    ]
    for layer, position in repairs:
        canvas.alpha_composite(layer, position)

    canvas.convert("RGB").save(OUT, quality=96)
    print(OUT)


if __name__ == "__main__":
    main()
