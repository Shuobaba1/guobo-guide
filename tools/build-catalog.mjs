/* 抓取国博「古代中国」官网 8 个单元详情页里的展品清单，生成 catalog.js。
 * 数据来源：https://www.chnmuseum.cn/portals/0/web/zt/gudai/detailN.html
 * 只抓展签上的名称、时代/文化、材质、出土/尺寸，不下载、不打包官网图片。
 * 运行：node tools/build-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const base = 'https://www.chnmuseum.cn/portals/0/web/zt/gudai/';
const imageDir = path.join(root, 'assets', 'catalog');
const cacheDir = path.join(here, 'cache');
fs.mkdirSync(imageDir, { recursive: true });

const UNITS = [
  { page: 1, id: 'g-yuan-gu', name: '远古' },
  { page: 2, id: 'g-xia-shang-zhou', name: '夏商西周' },
  { page: 3, id: 'g-chun-qiu', name: '春秋战国' },
  { page: 4, id: 'g-qin-han', name: '秦汉' },
  { page: 5, id: 'g-wei-jin', name: '三国两晋南北朝' },
  { page: 6, id: 'g-sui-tang', name: '隋唐五代' },
  { page: 7, id: 'g-song-yuan', name: '辽宋夏金元' },
  { page: 8, id: 'g-ming-qing', name: '明清' }
];

// 展览页只给 185px 缩略图；这几件从国博单件藏品页取高清图。
const HIGH_RES = {
  '涡纹四系彩陶罐': 'https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/P020220802364217117881.jpg',
  '小口尖底陶瓶': 'https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/P020220805564054800087.jpg',
  '陶猪': 'https://www.chnmuseum.cn/zp/zpml/kgfjp/202107/P020220811396834502556.jpg'
};

const ERA_RE = /文化|时代|时期|王朝|朝|代|世纪|年前|遗址|国|夏|商|周|春秋|战国|秦|汉|三国|两晋|晋|南北朝|隋|唐|五代|宋|辽|金|元|明|清/;
const MAT_RE = /绢本|纸本|设色|水墨|青瓷|白瓷|青花|釉|陶|瓷|铜|玉|金|银|铁|石|木|漆|丝|棉|麻|骨|角|蚌|纸|琉璃|珐琅/;
const DIM_RE = /^(纵|横|高|长|宽|口径|通高|足径|底径|重|厚)/;

function decode(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMeta(line) {
  let era = '';
  let material = '';
  for (const raw of String(line || '').split(/[，,]/)) {
    const part = raw.trim();
    if (!part) continue;
    if (MAT_RE.test(part) && !/文化|时代|时期|王朝/.test(part)) {
      material = material ? material + '，' + part : part;
    } else if (ERA_RE.test(part)) {
      era = era ? era + '，' + part : part;
    } else if (!era) {
      era = part;
    } else {
      material = material ? material + '，' + part : part;
    }
  }
  return { era, material };
}

function splitNote(line) {
  let unearthed = '';
  let size = '';
  for (const raw of String(line || '').split(/[；;]/)) {
    const part = raw.replace(/[）)]\s*$/, '').trim();
    if (!part) continue;
    if (DIM_RE.test(part) || (/[厘米毫米]/.test(part) && !/出土|征集|采集|传/.test(part))) {
      size = size ? size + '；' + part : part;
    } else if (/出土|征集|采集|传|拨交|捐赠/.test(part)) {
      unearthed = unearthed ? unearthed + '；' + part : part;
    } else if (!unearthed) {
      unearthed = part;
    } else if (!size) {
      size = part;
    }
  }
  return { unearthed, size };
}

const items = [];
const skipped = [];
const seen = new Set();
const perUnit = {};
let imageCount = 0;

for (const unit of UNITS) {
  const url = base + 'detail' + unit.page + '.html';
  const cacheFile = path.join(cacheDir, 'detail' + unit.page + '.html');
  let html;
  if (fs.existsSync(cacheFile)) {
    html = fs.readFileSync(cacheFile, 'utf8');
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
    html = Buffer.from(await res.arrayBuffer()).toString('utf8');
  }
  const blocks = [...html.matchAll(/<div class="ilitems">([\s\S]*?)<div class="ilwords">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ media: m[1], words: m[2] }));
  let count = 0;
  for (const { media, words } of blocks) {
    const block = words;
    const nameMatch = block.match(/<span>([\s\S]*?)<\/span>/);
    if (!nameMatch) continue;
    const name = decode(nameMatch[1]).replace(/[）)]\s*$/, '').trim();
    if (!name) continue;
    if (!/[\u4e00-\u9fa5]/.test(name)) { skipped.push({ unit: unit.name, name, reason: '非中文条目' }); continue; }
    if (/□/.test(name)) { skipped.push({ unit: unit.name, name, reason: '官网原文缺字' }); continue; }
    const key = unit.id + '|' + name;
    if (seen.has(key)) { skipped.push({ unit: unit.name, name, reason: '同名重复' }); continue; }
    seen.add(key);
    const rest = block.slice(nameMatch.index + nameMatch[0].length);
    const lines = rest.split(/<br\s*\/?>/i).map(decode).filter(Boolean);
    const meta = splitMeta(lines[0] || '');
    const note = splitNote(lines.slice(1).join('；'));
    let img = '';
    const imgMatch = media.match(/<img[^>]+src="([^"]+)"/i);
    const imgSrc = HIGH_RES[name] || (imgMatch ? imgMatch[1] : '');
    if (imgSrc) {
      const fileName = 'p' + unit.page + '-' + (count + 1) + '.jpg';
      const imagePath = path.join(imageDir, fileName);
      try {
        if (!fs.existsSync(imagePath)) {
          const imgRes = await fetch(new URL(imgSrc, url).href, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36' } });
          if (imgRes.ok) fs.writeFileSync(imagePath, Buffer.from(await imgRes.arrayBuffer()));
        }
        if (fs.existsSync(imagePath)) {
          img = 'assets/catalog/' + fileName;
          imageCount += 1;
        }
      } catch (e) { /* 单张图失败不影响名录 */ }
    }
    items.push({ n: name, e: meta.era, m: meta.material, u: note.unearthed, d: note.size, g: unit.id, s: unit.page, img });
    count += 1;
  }
  perUnit[unit.name] = count;
}

/* 官网这 8 页没有列全。补两件示例里已有数据的重器，再补两件官网单独介绍、但不在展品页的。 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'seed.js'), 'utf8'), sandbox);
const seedPicks = (sandbox.window.SEED_DATA.artifacts || []).filter((a) => /后母戊|吴王夫差/.test(a.name));
const extras = [
  ...seedPicks.map((a) => ({
    n: a.name, a: a.alias, e: a.era, m: a.material, w: a.weight, u: a.unearthed, d: a.size,
    g: a.galleryId, s: 0, img: a.image, src: (a.sources && a.sources[0] && a.sources[0].url) || ''
  })),
  {
    n: '大盂鼎', e: '西周早期', m: '青铜', w: '153.5千克', u: '传清道光年间陕西岐山县礼村出土',
    d: '通高101.9厘米，口径77.8厘米', g: 'g-xia-shang-zhou', s: 0,
    src: 'https://www.chnmuseum.cn/portals/0/web/zt/202106dayuding/'
  },
  {
    n: '虢季子白盘', e: '西周', m: '青铜', w: '215.3千克', u: '传清道光年间陕西宝鸡虢川司出土',
    d: '长137.2厘米，宽86.5厘米，高39.5厘米', g: 'g-xia-shang-zhou', s: 0,
    src: 'https://www.chnmuseum.cn/portals/0/web/zt/100n/guobao_content-2.html?id=24'
  }
];
for (const item of extras) {
  const key = item.g + '|' + item.n;
  if (seen.has(key)) continue;
  seen.add(key);
  items.push(item);
}

const payload = {
  source: '中国国家博物馆「古代中国」基本陈列官网展品页',
  sourceUrl: base + 'default.html',
  note: '仅含展签名称、时代/文化、材质与出土/尺寸，图片版权归原权利人所有，不随本文件分发。',
  generated: new Date().toISOString().slice(0, 10),
  count: items.length,
  imageCount,
  units: UNITS.map((u) => ({ id: u.id, name: u.name, page: u.page })),
  items
};

const body = JSON.stringify(payload, null, 0)
  .replace(/},{/g, '},\n{')
  .replace(/"items":\[/, '"items":[\n');
const js = '/* 自动生成，请勿手改；重新生成：node tools/build-catalog.mjs */\n' +
  'window.CATALOG_DATA = ' + body + ';\n';

fs.writeFileSync(path.join(root, 'catalog.js'), js, 'utf8');
console.log('catalog.js', items.length, 'items', (fs.statSync(path.join(root, 'catalog.js')).size / 1024).toFixed(1) + ' KB');
console.log('images', imageCount, 'files');
console.log('per unit', JSON.stringify(perUnit));
if (skipped.length) console.log('skipped', JSON.stringify(skipped, null, 2));
