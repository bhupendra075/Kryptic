from pathlib import Path
from PIL import Image, ImageDraw
import math

PUBLIC = Path(__file__).resolve().parent.parent / "public"
for size in (192, 512):
    image = Image.new("RGB", (size, size), "#111512")
    draw = ImageDraw.Draw(image)
    center = size / 2
    radius = size * 0.27
    for angle in range(0, 360, 45):
        radians = math.radians(angle)
        x = center + math.cos(radians) * radius
        y = center + math.sin(radians) * radius
        draw.line((center, center, x, y), fill="#c7e8ad", width=max(8, size // 28))
    dot = size * 0.085
    draw.ellipse((center - dot, center - dot, center + dot, center + dot), fill="#c7e8ad")
    image.save(PUBLIC / f"icon-{size}.png")
