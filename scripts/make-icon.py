"""Render the storefront icon: a speech bubble carrying a quotation mark."""
from PIL import Image, ImageDraw

SS = 32
BLUE = (31, 111, 235)
WHITE = (255, 255, 255)


def scaled(*values):
    return tuple(round(value * SS) for value in values)


def render(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (64 * SS, 64 * SS), (0, 0, 0, 0))

    def layer():
        return Image.new("RGBA", canvas.size, (0, 0, 0, 0))

    # Bubble body with a soft fill and a solid hairline stroke.
    body = layer()
    ImageDraw.Draw(body).rounded_rectangle(
        scaled(8, 10, 56, 46), radius=10 * SS, fill=BLUE + (46,),
    )
    canvas.alpha_composite(body)

    stroke = layer()
    ImageDraw.Draw(stroke).rounded_rectangle(
        scaled(8, 10, 56, 46), radius=10 * SS,
        outline=BLUE + (255,), width=3 * SS,
    )
    # Tail: a small triangle hanging from the bubble's lower left.
    ImageDraw.Draw(stroke).polygon(
        [scaled(18, 44), scaled(18, 56), scaled(30, 45)],
        fill=BLUE + (255,),
    )
    canvas.alpha_composite(stroke)

    # Two quotation marks: a filled head plus a short tail each.
    glyph = layer()
    draw = ImageDraw.Draw(glyph)
    for x in (24, 38):
        draw.ellipse(scaled(x, 22, x + 10, 32), fill=WHITE + (255,))
        draw.polygon(
            [scaled(x + 1, 30), scaled(x + 1, 36), scaled(x + 9, 31)],
            fill=WHITE + (255,),
        )
    canvas.alpha_composite(glyph)

    return canvas.resize((size, size), Image.LANCZOS)


import os
os.makedirs("assets", exist_ok=True)
for pixels in (180, 512):
    render(pixels).save(f"assets/icon-{pixels}.png", optimize=True)
print("written: assets/icon-180.png, assets/icon-512.png")
