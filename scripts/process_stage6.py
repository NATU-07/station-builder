"""Stage6 画像: 透過済み画像から αクリーン + タイトクロップ。"""
from pathlib import Path
from PIL import Image

SRC = Path(r"C:\Users\teset\Downloads\_c09eeaa0-da04-49a5-9770-5f3b2a698f70-removebg-preview (1).png")
OUT_FINAL = Path(r"D:\ゲーム制作\station-builder\assets\station_stage6.png")

print(f"loading {SRC}")
src = Image.open(SRC).convert("RGBA")
print(f"size: {src.size}")

print("alpha threshold...")
pixels = src.load()
w, h = src.size
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a < 30:
            pixels[x, y] = (0, 0, 0, 0)

print("tight cropping...")
bbox = src.getbbox()
print(f"bbox: {bbox}")
cropped = src.crop(bbox) if bbox else src

cropped.save(OUT_FINAL)
print(f"saved {OUT_FINAL} size={cropped.size}")
