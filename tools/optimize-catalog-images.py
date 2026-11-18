"""压缩 assets/catalog 下的官网缩略图：保持尺寸，降低 JPEG 质量，去掉元数据。
运行：python tools/optimize-catalog-images.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
folder = root / "assets" / "catalog"
before = after = 0
count = 0
for path in sorted(folder.glob("*.jpg")):
    before += path.stat().st_size
    img = Image.open(path).convert("RGB")
    img.save(path, "JPEG", quality=78, optimize=True, progressive=True)
    after += path.stat().st_size
    count += 1

print(f"{count} images  {before/1024/1024:.2f} MB -> {after/1024/1024:.2f} MB")
