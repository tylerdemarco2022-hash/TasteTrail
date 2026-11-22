#!/usr/bin/env python3
"""Write solid TasteTrails app icons without extra image libraries."""
import struct
import zlib
from pathlib import Path

ORANGE = (249, 115, 22)
WHITE = (255, 255, 255)
DEEP = (194, 65, 12)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, width, height, pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y, width, height))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    Path(path).write_bytes(png)


def icon_pixel(x, y, width, height):
    nx = (x + 0.5) / width
    ny = (y + 0.5) / height
    # White fork centered on an orange field. No transparency.
    handle = abs(nx - 0.5) < 0.045 and 0.40 < ny < 0.82
    shoulder = abs(ny - 0.40) < 0.028 and abs(nx - 0.5) < 0.16
    tines = 0.18 < ny < 0.42 and any(abs(nx - tx) < 0.026 for tx in (0.36, 0.50, 0.64))
    if handle or shoulder or tines:
        return WHITE
    return ORANGE


def main():
    root = Path(__file__).resolve().parents[1]
    public = root / 'public'
    public.mkdir(exist_ok=True)
    write_png(public / 'apple-touch-icon.png', 180, 180, icon_pixel)
    write_png(public / 'favicon.png', 32, 32, icon_pixel)
    icon_dir = root / 'ios' / 'App' / 'App' / 'Assets.xcassets' / 'AppIcon.appiconset'
    icon_dir.mkdir(parents=True, exist_ok=True)
    write_png(icon_dir / 'AppIcon-1024.png', 1024, 1024, icon_pixel)
    (icon_dir / 'Contents.json').write_text('''{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
''', encoding='utf-8')
    stale = icon_dir / 'AppIcon-512@2x.png'
    if stale.exists():
        stale.unlink()
    print('wrote icons')


if __name__ == '__main__':
    main()
