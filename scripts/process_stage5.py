"""Stage5 画像: 既に透過済みの画像からピンクみを抜いて青灰寄りに補正。"""
from pathlib import Path
from PIL import Image
import colorsys

SRC = Path(r"C:\Users\teset\Downloads\_783c5075-3cbe-4db4-b7c5-de9196de5756-removebg-preview.png")
OUT_FINAL = Path(r"D:\ゲーム制作\station-builder\assets\station_stage5.png")

print(f"loading {SRC}")
src = Image.open(SRC).convert("RGBA")
w, h = src.size
print(f"size: {w}x{h}")

print("removing pink tint (shift warm hues toward neutral blue-gray)...")
pixels = src.load()

def desaturate_pink(r, g, b):
    """ピンク/赤系の色を青灰に寄せる。"""
    h_, l_, s_ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    # ピンク・赤寄りの色相 (0.85〜1.0, 0.0〜0.08) を検出
    is_pink = (h_ > 0.85 or h_ < 0.08)
    if is_pink and s_ > 0.05:
        # 彩度を大幅に下げる
        s_ = s_ * 0.15
        # 色相を青寄り(0.58)に少し寄せる
        # 一気に動かすと不自然なので軽く
        target = 0.58
        h_ = target
    # 追加: 全体的に赤チャンネルを少し下げる
    r2, g2, b2 = colorsys.hls_to_rgb(h_, l_, s_)
    # 微調整: Rをさらに2%下げ、Bを2%上げて青灰寄りに
    r2 = max(0, r2 - 0.02)
    b2 = min(1, b2 + 0.02)
    return int(r2 * 255), int(g2 * 255), int(b2 * 255)

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a < 10:
            continue
        nr, ng, nb = desaturate_pink(r, g, b)
        pixels[x, y] = (nr, ng, nb, a)

print("tight cropping...")
bbox = src.getbbox()
print(f"bbox: {bbox}")
cropped = src.crop(bbox) if bbox else src

cropped.save(OUT_FINAL)
print(f"saved {OUT_FINAL} size={cropped.size}")
