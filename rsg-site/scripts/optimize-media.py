#!/usr/bin/env python3
"""壓縮 public/media 圖片（需要 pip install pillow）。

- JPEG：品質 82、漸進式，寬度超過 MAX_W 縮到 MAX_W
- PNG 有真正透明且超過 WEBP_MIN：轉成有透明的 WebP（.webp）
- PNG 有真正透明但很小（logo、icon）：維持 PNG，只縮尺寸與最佳化
- PNG 不透明：轉成 JPEG（.jpg）
- 改副檔名的都會改寫 content/ 與 src/site.ts 裡的引用，舊路徑寫進 scripts/_redirects.base 做 301
用法：python scripts/optimize-media.py [--dry-run]
"""
import os, sys, glob, re, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'public', 'media')
MAX_W = 1920
Q_JPG = 82
Q_WEBP = 82
WEBP_MIN = 200 * 1024   # 透明 PNG 超過這個大小才轉 WebP
DRY = '--dry-run' in sys.argv

def has_alpha(im):
    if im.mode == 'P':
        if 'transparency' not in im.info: return False
        im = im.convert('RGBA')
    if im.mode in ('RGBA', 'LA'):
        return im.getchannel('A').getextrema()[0] < 255
    return False

def shrink(im):
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    return im

renames = {}   # /media/old.png -> /media/new.jpg / .webp
prev = os.path.join(ROOT, 'content', 'media-renames.json')
if os.path.exists(prev): renames.update(json.load(open(prev, encoding='utf-8')))
before = after = 0
for p in sorted(glob.glob(os.path.join(MEDIA, '**', '*'), recursive=True)):
    ext = os.path.splitext(p)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png'): continue
    s0 = os.path.getsize(p); before += s0
    im = Image.open(p); im.load()
    rel = '/media/' + os.path.relpath(p, MEDIA).replace(os.sep, '/')
    if ext in ('.jpg', '.jpeg'):
        out = shrink(im.convert('RGB')); dest = p
        if not DRY: out.save(dest, 'JPEG', quality=Q_JPG, optimize=True, progressive=True)
    elif has_alpha(im):
        out = shrink(im.convert('RGBA'))
        if s0 > WEBP_MIN:
            dest = os.path.splitext(p)[0] + '.webp'
            if not DRY:
                out.save(dest, 'WEBP', quality=Q_WEBP, method=6)
                os.remove(p)
            renames[rel] = '/media/' + os.path.relpath(dest, MEDIA).replace(os.sep, '/')
        else:
            dest = p
            if not DRY: out.save(dest, 'PNG', optimize=True)
    else:
        out = shrink(im.convert('RGB'))
        dest = os.path.splitext(p)[0] + '.jpg'
        if os.path.exists(dest): dest = os.path.splitext(p)[0] + '-png.jpg'
        if not DRY:
            out.save(dest, 'JPEG', quality=Q_JPG, optimize=True, progressive=True)
            os.remove(p)
        renames[rel] = '/media/' + os.path.relpath(dest, MEDIA).replace(os.sep, '/')
    s1 = os.path.getsize(dest) if not DRY else s0; after += s1

print(f'圖片：{before/1e6:.1f} MB -> {after/1e6:.1f} MB；PNG 轉 JPG {len(renames)} 個')
if DRY or not renames: sys.exit(0)

# 改寫引用
targets = glob.glob(os.path.join(ROOT, 'content', '**', '*.md'), recursive=True) + \
          [os.path.join(ROOT, 'content', 'banners.json'), os.path.join(ROOT, 'src', 'site.ts')]
changed = 0
for f in targets:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read(); t = s
    for old, new in renames.items():
        t = t.replace(old, new)
    if t != s:
        open(f, 'w', encoding='utf-8').write(t); changed += 1
print(f'改寫引用：{changed} 個檔案')

# 舊 PNG 路徑 301 到新 JPG
base = os.path.join(ROOT, 'scripts', '_redirects.base')
s = open(base, encoding='utf-8').read().rstrip('\n')
marker = '# ---- PNG 轉 JPG 後的舊圖片路徑（scripts/optimize-media.py 產生）----'
if marker in s: s = s[:s.index(marker)].rstrip('\n')
s += '\n\n' + marker + '\n' + '\n'.join(f'{o}  {n}  301' for o, n in renames.items()) + '\n'
open(base, 'w', encoding='utf-8').write(s)
json.dump(renames, open(os.path.join(ROOT, 'content', 'media-renames.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('已更新 scripts/_redirects.base，請執行 npm run redirects')
