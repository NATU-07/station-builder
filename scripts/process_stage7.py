"""Stage7 画像: 緑背景をChroma Keyで透過 + タイトクロップ。"""
from pathlib import Path
from PIL import Image

SRC = Path(r"D:\ゲーム制作\station-builder\assets\Gemini_Generated_Image_h4uxf5h4uxf5h4ux (1).png")
OUT_FINAL = Path(r"D:\ゲーム制作\station-builder\assets\station_stage7.png")

print(f"loading {SRC}")
src = Image.open(SRC).convert("RGBA")
w, h = src.size
print(f"size: {w}x{h}")

print("chroma key (pure green removal)...")
pixels = src.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        # 緑判定: Gが他より大きく、かつGが明るい
        if g > 140 and g > r * 1.4 and g > b * 1.4:
            pixels[x, y] = (0, 0, 0, 0)
        # エッジの半透明処理: 緑寄りだが建物要素でもある境界
        elif g > 120 and g > r * 1.2 and g > b * 1.2:
            # 緑成分を引いて半透明に
            new_a = max(0, a - 128)
            pixels[x, y] = (r, g, b, new_a)

print("tight cropping...")
bbox = src.getbbox()
print(f"bbox: {bbox}")
cropped = src.crop(bbox) if bbox else src

# 上部の装飾（アンテナ・小ドーム）を少しだけ削って横長化
cw, ch = cropped.size
top_crop = int(ch * 0.15)
cropped = cropped.crop((0, top_crop, cw, ch))
print(f"after top trim: {cropped.size} (ratio={cropped.size[0]/cropped.size[1]:.2f})")

cropped.save(OUT_FINAL)
print(f"saved {OUT_FINAL}")
