/* 把多文件版本打包成单个 HTML，方便直接双击打开或发给别人。
 * 运行：node tools/build-standalone.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'dist');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let seed = fs.readFileSync(path.join(root, 'seed.js'), 'utf8');
let catalog = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
let capital = fs.readFileSync(path.join(root, 'capital-catalog.js'), 'utf8');
let content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
let stories = fs.readFileSync(path.join(root, 'stories.js'), 'utf8');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// 把示例图和名录缩略图都变成 data URL，保证单文件离线可看。
function inlineImages(source) {
  for (const dir of ['assets/seed', 'assets/catalog', 'assets/capital']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      const rel = dir + '/' + file;
      if (source.indexOf(rel) < 0) continue;
      const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
      const b64 = fs.readFileSync(path.join(abs, file)).toString('base64');
      source = source.split(rel).join('data:' + mime + ';base64,' + b64);
    }
  }
  return source;
}
seed = inlineImages(seed);
catalog = inlineImages(catalog);
capital = inlineImages(capital);

seed = seed.replace(/<\/script/gi, '<\\/script');
catalog = catalog.replace(/<\/script/gi, '<\\/script');
capital = capital.replace(/<\/script/gi, '<\\/script');
content = content.replace(/<\/script/gi, '<\\/script');
stories = stories.replace(/<\/script/gi, '<\\/script');
app = app.replace(/<\/script/gi, '<\\/script');

html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
html = html.replace(/\s*<link rel="icon"[^>]*>/, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = html.replace('<script src="catalog.js"></script>', '<script>\n' + catalog + '\n</script>');
html = html.replace('<script src="capital-catalog.js"></script>', '<script>\n' + capital + '\n</script>');
html = html.replace('<script src="content.js"></script>', '<script>\n' + content + '\n</script>');
html = html.replace('<script src="seed.js"></script>', '<script>\n' + seed + '\n</script>');
html = html.replace('<script src="stories.js"></script>', '<script>\n' + stories + '\n</script>');
html = html.replace('<script src="app.js"></script>', '<script>window.__STANDALONE__ = true;</script>\n<script>\n' + app + '\n</script>');
html = html.replace('<title>国博讲解手册 · 古代中国</title>', '<title>国博讲解手册 · 古代中国（单文件版）</title>');

fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, '国博讲解手册.html');
fs.writeFileSync(out, html, 'utf8');
console.log('built', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
