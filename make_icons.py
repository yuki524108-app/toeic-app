#!/usr/bin/env python3
"""
PWA用のアイコン（PNG）を、public/favicon.svg と同じ形状から描き出す。

  python3 tools/make_icons.py

出力（public/）:
  pwa-192x192.png        ホーム画面用（角丸・背景透過）
  pwa-512x512.png        同上
  maskable-512x512.png   マスカブル用（全面を塗りつぶし、文字は中央の安全領域に収める）
  apple-touch-icon.png   iOSのホーム画面用（180x180、全面を塗りつぶし）

形状やサイズを変えたときは、favicon.svg と、このスクリプトの図形を合わせて更新する。
"""
from pathlib import Path
from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"
NAVY, GOLD, SOFT = (0x16, 0x21, 0x3E), (0xC9, 0x93, 0x2C), (0xF3, 0xE4, 0xC4)
SCALE = 4  # 4倍で描いてから縮小し、輪郭をなめらかにする


def draw(size, rounded):
    s = size * SCALE
    k = s / 512  # 512x512 の図面から拡大縮小する倍率
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(112 * k), fill=NAVY)
    else:
        d.rectangle([0, 0, s, s], fill=NAVY)

    def rr(x, y, w, h, r, color):
        d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + h) * k], radius=r * k, fill=color)

    rr(136, 150, 240, 56, 14, GOLD)   # Tの横棒
    rr(228, 150, 56, 220, 14, GOLD)   # Tの縦棒
    rr(176, 396, 160, 16, 8, SOFT)    # 下線
    return img.resize((size, size), Image.LANCZOS)


def main():
    draw(192, True).save(PUBLIC / "pwa-192x192.png")
    draw(512, True).save(PUBLIC / "pwa-512x512.png")
    draw(512, False).save(PUBLIC / "maskable-512x512.png")
    draw(180, False).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
    for n in ["pwa-192x192.png", "pwa-512x512.png", "maskable-512x512.png", "apple-touch-icon.png"]:
        with Image.open(PUBLIC / n) as im:
            print(f"{n:24s} {im.size[0]}x{im.size[1]} {(PUBLIC / n).stat().st_size / 1000:.1f}KB")


if __name__ == "__main__":
    main()
