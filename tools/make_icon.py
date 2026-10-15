#!/usr/bin/env python3
"""هوهو's icon — one character, two compositions, three files.

    app/src/main/res/drawable/ic_launcher_foreground.xml   the launcher
    project/store/icon-512.png                             the Bazaar store page

Why two compositions and not one picture scaled twice: a store page shows the icon big and
alone, so it can carry a desk full of things — books, a pencil, a ruler, numbers in the air. A
launcher draws it at about forty-eight pixels, among thirty others, and cuts it to a shape of
its choosing. Everything on that desk turns to porridge at that size. So the launcher gets the
owl, her pencil and her books, and nothing else; the store gets the lot. The owl herself is one
piece of code, so the two can never become different owls.

Both are laid out in the vector's 108 coordinates and then *fitted*: the code measures what was
drawn and scales it to the radius it is allowed, rather than anyone nudging numbers by hand.
For the launcher that radius is 33, which is all an adaptive mask promises to keep.
"""
import math
import os

VIEWPORT = 108
CENTRE = VIEWPORT / 2
SAFE_RADIUS = 33               # what an adaptive mask is guaranteed to keep
STORE_RADIUS = 46              # the store icon has no mask, so it may fill much more

SIZE = 512
SUPER = 4                      # drawn this many times bigger, then shrunk: smooth edges

# the app's own palette, plus the brighter accents a child's icon wants
PAPER = "#FDF4E3"
ORANGE = "#E8973A"
ORANGE_DARK = "#D8811F"
CREAM = "#FDF4E3"
WHITE = "#FFFFFF"
INK = "#3B3027"
TEAL = "#3AA79A"
PINK = "#D94F7A"
POLLEN = "#F7C94B"

BOOK_BLUE = "#2F6FE4"
BOOK_BLUE_DARK = "#2459BC"
BOOK_PURPLE = "#8B5CF6"
BOOK_PURPLE_DARK = "#7C3AED"
PAGES = "#FBF4E6"

PENCIL = "#48BB54"
PENCIL_DARK = "#2F9A3C"
WOOD = "#F2C98A"
ERASER = "#F2708F"
BAND = "#F4B63F"
RULER = "#45B6F0"

NUM_GREEN = "#3EAE4B"
NUM_AMBER = "#F3B63B"
NUM_BLUE = "#2F8FE4"
OP_PINK = "#E8486F"
OP_PURPLE = "#8B5CF6"
OP_TEAL = "#3AA79A"
OP_ORANGE = "#F2902A"


# ── little builders ─────────────────────────────────────────────────────────

def circle(cx, cy, r, colour):
    return ("circle", (cx, cy, r), colour)


def ellipse(cx, cy, rx, ry, colour):
    return ("ellipse", (cx, cy, rx, ry), colour)


def poly(points, colour):
    return ("poly", list(points), colour)


def rect(x1, y1, x2, y2, colour):
    return poly([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], colour)


def bar(cx, cy, half_w, half_h, colour):
    return rect(cx - half_w, cy - half_h, cx + half_w, cy + half_h, colour)


def beam(a, b, width, colour):
    """A thick line from a to b — what a pencil, a ruler and a slash sign are made of."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy) or 1
    px, py = -dy / length * width / 2, dx / length * width / 2
    return poly([(a[0] + px, a[1] + py), (b[0] + px, b[1] + py),
                 (b[0] - px, b[1] - py), (a[0] - px, a[1] - py)], colour)


def along(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ── the character ───────────────────────────────────────────────────────────

def owl():
    """هوهو herself: the same owl girl the app draws, flower and all — minus the wings, which
    go on last so they close over whatever she is holding."""
    out = [
        poly([(42, 35), (40, 25), (52, 31)], ORANGE_DARK),      # ear tufts
        poly([(66, 35), (68, 25), (56, 31)], ORANGE_DARK),
        ellipse(54, 52, 21, 22, ORANGE),                        # body and head in one
        ellipse(54, 46, 14.5, 12.5, CREAM),                     # face plate
    ]
    for eye_x in (47, 61):
        out.append(circle(eye_x, 45, 6.4, WHITE))
        out.append(circle(eye_x, 45, 2.7, INK))
        out.append(circle(eye_x + 1.4, 43.6, 1.1, WHITE))
    out.append(poly([(54, 51), (57.3, 57), (50.7, 57)], ORANGE_DARK))   # beak

    # the flower beside her ear — the thing that makes her her
    for px, py in ((33, 34), (36, 31), (36, 37), (39, 34)):
        out.append(circle(px, py, 3.6, PINK))
    out.append(circle(36, 34, 2.8, POLLEN))
    return out


def wings():
    """Drawn after the pencil and the ruler, so she is holding them rather than standing
    behind them."""
    return [
        ellipse(36, 62, 5.4, 8, ORANGE_DARK),
        ellipse(72, 62, 5.4, 8, ORANGE_DARK),
    ]


def books():
    """Two books she stands behind, the way the reference has her at a desk. The thin strip of
    cream along the bottom of each is the page edge — without it a book is just a coloured bar.

    Split in two: the part behind her and the part in front, so whatever she holds can pass
    between them.
    """
    return [rect(30, 70, 78, 74, PAGES), rect(25, 79, 83, 83, PAGES)]


def book_covers():
    return [
        rect(32, 72, 76, 81, BOOK_BLUE),
        rect(34, 77, 74, 80, PAGES),
        rect(27, 81, 81, 91, BOOK_PURPLE),
        rect(29, 86.5, 79, 89.5, PAGES),
    ]


def pencil():
    """Held in her left wing, pointing up the way a pencil is held to write. Its foot slips in
    behind the books; its tip clears her shoulder."""
    foot, head = (19, 82), (36, 42)
    body_end = along(foot, head, 0.82)
    tip_base = along(foot, head, 0.88)
    return [
        beam(along(foot, head, -0.05), along(foot, head, 0.05), 5.4, ERASER),
        beam(along(foot, head, 0.04), along(foot, head, 0.10), 5.4, BAND),
        beam(along(foot, head, 0.10), body_end, 5.4, PENCIL),
        beam(along(foot, head, 0.40), body_end, 1.7, PENCIL_DARK),     # a highlight down one side
        poly([_side(tip_base, head, 2.7), _side(tip_base, head, -2.7), head], WOOD),
        poly([_side(along(foot, head, 0.96), head, 1.1),
              _side(along(foot, head, 0.96), head, -1.1), head], INK),
    ]


def ruler():
    """In her other wing. Store only — at launcher size its marks are a smear."""
    foot, head = (88, 80), (73, 44)
    out = [beam(foot, head, 6.6, RULER)]
    for i in range(1, 7):                                       # the measuring marks
        at = along(foot, head, i / 7)
        out.append(beam(_side(at, head, 2.4), _side(at, head, -0.4), 1.1, WHITE))
    return out


def _side(point, towards, offset):
    """A point pushed sideways off the line that runs to `towards`."""
    dx, dy = towards[0] - point[0], towards[1] - point[1]
    length = math.hypot(dx, dy) or 1
    return (point[0] - dy / length * offset, point[1] + dx / length * offset)


def operators():
    """The signs floating around her in the maths app. Unused here: letters take their place."""
    out = []
    out += [bar(16, 44, 6, 2.2, OP_TEAL)]                               # −
    out += [bar(94, 26, 6.5, 2.3, OP_PINK), bar(94, 26, 2.3, 6.5, OP_PINK)]   # +
    out += [beam((88, 54), (100, 66), 4.6, OP_PURPLE),                  # ×
            beam((100, 54), (88, 66), 4.6, OP_PURPLE)]
    out += [bar(92, 86, 6, 2.2, OP_ORANGE),                             # ÷
            circle(92, 80.5, 2.4, OP_ORANGE), circle(92, 91.5, 2.4, OP_ORANGE)]
    return out


# ── the two compositions ────────────────────────────────────────────────────

def launcher_art():
    """Owl, pencil, books. Nothing that cannot be read at the size of a fingernail."""
    return books() + owl() + pencil() + wings() + book_covers()


def store_art():
    # هوهو فارسی: no maths signs — the letters around her (below, in DIGITS) say what she teaches
    return books() + owl() + pencil() + wings() + book_covers()


# the letters over her head and at her sides, drawn with the app's own typeface — store only,
# since at launcher size a letter is five pixels tall and may as well be a smudge. «آ ب پ» in an
# arc above, and «ف ا ر س ی» down her sides: the alphabet she teaches and the name of the book.
DIGITS = [("آ", 30, 20, NUM_GREEN), ("ب", 54, 15, NUM_AMBER), ("پ", 78, 20, NUM_BLUE),
          ("ف", 14, 44, OP_TEAL), ("ا", 16, 66, OP_ORANGE),
          ("ر", 94, 34, OP_PINK), ("س", 94, 58, OP_PURPLE), ("ی", 92, 82, OP_ORANGE)]
DIGIT_SIZE = 20


# ── fitting ─────────────────────────────────────────────────────────────────

def outline(shapes):
    """Every shape as points, which is all the fitting needs to know."""
    points = []
    for kind, data, _ in shapes:
        if kind == "poly":
            points += list(data)
        elif kind == "circle":
            cx, cy, r = data
            points += [(cx + r * math.cos(a * math.pi / 8), cy + r * math.sin(a * math.pi / 8))
                       for a in range(16)]
        else:
            cx, cy, rx, ry = data
            points += [(cx + rx * math.cos(a * math.pi / 8), cy + ry * math.sin(a * math.pi / 8))
                       for a in range(16)]
    return points


def fit(shapes, radius, extra_points=()):
    """How to move and scale a drawing so it sits in a circle of `radius` about the centre."""
    points = outline(shapes) + list(extra_points)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mid_x, mid_y = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    reach = max(math.hypot(x - mid_x, y - mid_y) for x, y in points)
    return radius / reach, mid_x, mid_y


def placed(point, how):
    k, mid_x, mid_y = how
    return (CENTRE + (point[0] - mid_x) * k, CENTRE + (point[1] - mid_y) * k)


def reshape(kind, data, how):
    k = how[0]
    if kind == "poly":
        return [placed(p, how) for p in data]
    if kind == "circle":
        cx, cy, r = data
        x, y = placed((cx, cy), how)
        return (x, y, r * k)
    cx, cy, rx, ry = data
    x, y = placed((cx, cy), how)
    return (x, y, rx * k, ry * k)


# ── the Android vector ──────────────────────────────────────────────────────

def fmt(value):
    text = ("%.2f" % value).rstrip("0").rstrip(".")
    return text if text else "0"


def path_for(kind, data):
    if kind == "poly":
        return ("M%s,%s " % (fmt(data[0][0]), fmt(data[0][1]))
                + " ".join("L%s,%s" % (fmt(x), fmt(y)) for x, y in data[1:]) + " Z")
    if kind == "circle":
        cx, cy, r = data
        return arc(cx, cy, r, r)
    return arc(*data)


def arc(cx, cy, rx, ry):
    # «<circle>» does not exist in an Android vector; a round shape is two half arcs
    return "M%s,%s a%s,%s 0 1,0 %s,0 a%s,%s 0 1,0 -%s,0" % (
        fmt(cx - rx), fmt(cy), fmt(rx), fmt(ry), fmt(rx * 2), fmt(rx), fmt(ry), fmt(rx * 2))


def write_vector(path):
    shapes = launcher_art()
    how = fit(shapes, SAFE_RADIUS)
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!-- ساخته‌ی tools/make_icon.py — با دست عوضش نکن؛ آن اسکریپت را عوض کن و دوباره بزن. -->',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="108dp"',
        '    android:height="108dp"',
        '    android:viewportWidth="108"',
        '    android:viewportHeight="108">',
        '',
    ]
    for kind, data, colour in shapes:
        lines.append('    <path android:fillColor="%s" android:pathData="%s" />'
                     % (colour, path_for(kind, reshape(kind, data, how))))
    lines += ['', '</vector>']
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    return how


# ── the store PNG ───────────────────────────────────────────────────────────

def write_png(path, font_file):
    from PIL import Image, ImageDraw, ImageFont

    shapes = store_art()
    digit_box = []
    for _, x, y, _ in DIGITS:
        digit_box += [(x - DIGIT_SIZE / 2, y - DIGIT_SIZE / 2), (x + DIGIT_SIZE / 2, y + DIGIT_SIZE / 2)]
    how = fit(shapes, STORE_RADIUS, digit_box)

    image = Image.new("RGB", (SIZE * SUPER, SIZE * SUPER), PAPER)
    draw = ImageDraw.Draw(image)
    scale = SIZE * SUPER / VIEWPORT

    def on_canvas(point):
        x, y = placed(point, how)
        return (x * scale, y * scale)

    for kind, data, colour in shapes:
        if kind == "poly":
            points = data
        else:
            cx, cy, rx, ry = (data + (data[2],))[:4] if kind == "circle" else data
            points = [(cx + rx * math.cos(i * math.pi / 120), cy + ry * math.sin(i * math.pi / 120))
                      for i in range(240)]
        draw.polygon([on_canvas(p) for p in points], fill=colour)

    font = ImageFont.truetype(font_file, int(DIGIT_SIZE * how[0] * scale))
    for glyph, x, y, colour in DIGITS:
        draw.text(on_canvas((x, y)), glyph, font=font, fill=colour, anchor="mm")

    image.resize((SIZE, SIZE), Image.LANCZOS).save(path, "PNG")


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    vector = os.path.join(root, "app/src/main/res/drawable/ic_launcher_foreground.xml")
    png = os.path.join(root, "project/store/icon-512.png")
    font_file = os.path.join(root, "app/src/main/res/font/vazirmatn_bold.ttf")
    os.makedirs(os.path.dirname(png), exist_ok=True)

    how = write_vector(vector)
    print("لانچر: %d شکل، مقیاس %.2f، داخلِ شعاعِ %d" % (len(launcher_art()), how[0], SAFE_RADIUS))
    write_png(png, font_file)
    print("فروشگاه: %d شکل + %d رقم" % (len(store_art()), len(DIGITS)))
    print("نوشته شد:", os.path.relpath(vector, root))
    print("نوشته شد:", os.path.relpath(png, root))


if __name__ == "__main__":
    main()
