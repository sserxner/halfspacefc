from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "local-preview" / "central-dribbler-local-preview.png"
TARGET = ROOT / "assets" / "masthead-library" / "central-dribbler.png"


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, _ = pixels[x, y]
            distance = abs(red - 255) + green + abs(blue - 255)
            alpha = max(0, min(255, round((distance - 20) * 3.2)))
            pixels[x, y] = (red, green, blue, alpha)
    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.35))
    rgba.putalpha(alpha)
    bounds = alpha.getbbox()
    return rgba.crop(bounds) if bounds else rgba


TARGET.parent.mkdir(parents=True, exist_ok=True)
remove_magenta(Image.open(SOURCE)).save(TARGET, optimize=True)
print(TARGET)
