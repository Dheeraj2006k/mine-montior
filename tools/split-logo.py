from pathlib import Path

from PIL import Image

source = Path("public/iris-logo-dark.png")
eye_target = Path("public/iris-eye-logo.png")
wordmark_target = Path("public/iris-wordmark.png")

img = Image.open(source).convert("RGBA")
w, h = img.size
alpha = img.getchannel("A")
bbox = alpha.getbbox()

if bbox is None:
    raise SystemExit("source image has no visible pixels")

left, top, right, bottom = bbox
eye_bottom = int(h * 0.635)
wordmark_top = int(h * 0.66)

def trim(image: Image.Image, padding: int) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return image

    l, t, r, b = bbox
    return image.crop((
        max(0, l - padding),
        max(0, t - padding),
        min(image.width, r + padding),
        min(image.height, b + padding),
    ))

trim(img.crop((left, top, right, eye_bottom)), 18).save(eye_target)
trim(img.crop((left, wordmark_top, right, bottom)), 12).save(wordmark_target)

print(f"saved {eye_target}")
print(f"saved {wordmark_target}")
