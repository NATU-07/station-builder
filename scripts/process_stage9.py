"""Stage9 画像: 緑背景をChroma Keyで透過 + タイトクロップ。"""
from pathlib import Path
from PIL import Image

SRC = Path(r"D:\ゲーム制作\station-builder\assets\Gemini_Generated_Image_jn472tjn472tjn47.png")
OUT_FINAL = Path(r"D:\ゲーム制作\station-builder\assets\station_stage9.png")

print(f"loading {SRC}")
src = Image.open(SRC).convert("RGBA")
w, h = src.size
print(f"size: {w}x{h}")

print("chroma key (pure green removal)...")
pixels = src.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if g > 140 and g > r * 1.4 and g > b * 1.4:
            pixels[x, y] = (0, 0, 0, 0)
        elif g > 120 and g > r * 1.2 and g > b * 1.2:
            new_a = max(0, a - 128)
            pixels[x, y] = (r, g, b, new_a)

print("tight cropping...")
bbox = src.getbbox()
print(f"bbox: {bbox}")
cropped = src.crop(bbox) if bbox else src

# 上下を削って横長化（ドームのトップと床の余白を詰める）
cw, ch = cropped.size
top_crop = int(ch * 0.05)
bottom_crop = int(ch * 0.08)
cropped = cropped.crop((0, top_crop, cw, ch - bottom_crop))
print(f"after trim: {cropped.size} (ratio={cropped.size[0]/cropped.size[1]:.2f})")

cropped.save(OUT_FINAL)
print(f"saved {OUT_FINAL}")
