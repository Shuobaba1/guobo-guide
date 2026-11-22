import fs from 'node:fs';

const target = await (await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
function send(method, params = {}) {
  return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || ''));
  return r.result?.result?.value;
}
async function waitFor(expr, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expr)) return true;
    await sleep(100);
  }
  return false;
}
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:4173', storageTypes: 'all' }).catch(() => {});
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173' });
await waitFor('document.querySelectorAll(".era-row").length === 8', 6000);

check('首页加载 8 个单元', await evaluate('document.querySelectorAll(".era-row").length') === 8);
check('首页统计 13 件文物', (await evaluate('document.querySelector(".hero-stats").innerText'))?.includes('13'));
await evaluate('document.querySelector(".theme-swatch[data-theme=ink]").click()');
await sleep(250);
check('底色切换', (await evaluate('document.documentElement.dataset.theme')) === 'ink');
await evaluate('document.querySelector(".theme-swatch[data-theme=paper]").click()');
await sleep(150);

await evaluate('document.querySelector(".era-row").click()');
await waitFor('location.hash.startsWith("#/g/")');
check('进入单元页', (await evaluate('location.hash')) === '#/g/g-yuan-gu');
check('单元页列出 3 件文物', await evaluate('document.querySelectorAll(".artifact-row").length') === 3);
check('顶部也有添加按钮', await evaluate('!!document.querySelector(".gallery-toolbar [data-action=add-artifact]")'));
check('校对入口已删除', await evaluate('!document.body.innerText.includes("待校对") && !document.querySelector("#f-status") && !document.querySelector(".status")'));
check('打开单元不自动聚焦', await evaluate('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
check('分栏空状态', await evaluate('!!document.querySelector(".split-empty")'));
await evaluate('document.querySelector(".artifact-row .color-dot").click()');
await sleep(250);
check('卡片颜色标记', await evaluate('document.querySelector(".artifact-row").classList.contains("cc-green")'));
await evaluate('document.querySelector(".artifact-row .color-dot").click()');
await sleep(200);
check('颜色循环到黄色', await evaluate('document.querySelector(".artifact-row").classList.contains("cc-yellow")'));

await evaluate('document.querySelector(".artifact-row").click()');
await waitFor('location.hash.includes("/a/")');
check('进入文物详情', (await evaluate('document.querySelector(".split-detail .artifact-title h1").innerText')).includes('鹳鱼石斧'));
check('详情深链接', (await evaluate('location.hash')).includes('#/g/g-yuan-gu/a/'));
check('打开详情不自动聚焦', await evaluate('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));

await evaluate('document.querySelector("[data-action=open-reader]").click()');
await waitFor('!!document.querySelector(".reader")');
check('讲解模式打开', await evaluate('!!document.querySelector(".reader-text")'));
check('讲解故事有内容', (await evaluate('document.querySelector(".reader-text").innerText')).length > 30);
await evaluate('document.querySelector("[data-action=reader-next]").click()');
await sleep(200);
check('讲解模式翻页', (await evaluate('document.querySelector(".reader-eyebrow").innerText')).includes('02'));
await evaluate('document.querySelector("[data-action=close-reader]").click()');
await sleep(200);
check('退出讲解模式', await evaluate('!document.querySelector(".reader")'));

await evaluate('document.querySelector("[data-action=edit-artifact]").click()');
await waitFor('!!document.querySelector("#artifact-form")');
check('编辑表单打开', await evaluate('!!document.querySelector("#f-name")'));
await evaluate('document.querySelector("#f-summary").value = "测试简介：用来验证编辑保存。"');
await evaluate('document.querySelector("#artifact-form").requestSubmit()');
await waitFor('!document.querySelector(".modal")');
await sleep(300);
check('编辑保存生效', (await evaluate('document.querySelector(".summary-panel p").innerText')).includes('测试简介'));

await evaluate('location.hash = "#/g/g-yuan-gu"');
await waitFor('document.querySelectorAll(".artifact-row").length === 3');
await evaluate('document.querySelector("[data-action=add-artifact]").click()');
await waitFor('!!document.querySelector("#catalog-search")');
check('添加时显示当前单元名录', (await evaluate('document.querySelectorAll(".catalog-row").length')) === 23);
await evaluate('document.querySelector(".catalog-row").click()');
await waitFor('!!document.querySelector("#f-name")');
check('已备稿自动填简介', ((await evaluate('document.querySelector("#f-summary").value')) || '').includes('彩陶之王'));
check('已备稿自动填故事', ((await evaluate('document.querySelector("#f-story").value')) || '').length > 200);
await evaluate('document.querySelector("[data-action=close-modal]").click()');
await sleep(150);
await evaluate('document.querySelector("[data-action=add-artifact]").click()');
await waitFor('!!document.querySelector("#catalog-search")');
await evaluate('const ci=document.querySelector("#catalog-search"); ci.value="鱼"; ci.dispatchEvent(new Event("input",{bubbles:true}));');
await sleep(250);
check('名录内搜索', ((await evaluate('document.querySelector(".catalog-name").innerText')) || '').includes('鱼'));
await evaluate('document.querySelector(".catalog-row").click()');
await waitFor('!!document.querySelector("#f-name")');
check('选中名录自动填年代', ((await evaluate('document.querySelector("#f-era").value')) || '').length > 0);
check('选中名录自动带图', ((await evaluate('document.querySelector("#f-image").value')) || '').includes('assets/catalog/'));
await evaluate('document.querySelector("[data-action=close-modal]").click()');
await sleep(150);

await evaluate('document.querySelector("[data-action=add-artifact]").click()');
await waitFor('!!document.querySelector("#catalog-search")');
await evaluate('document.querySelector("[data-action=manual-fill]").click()');
await waitFor('!!document.querySelector("#quick-name")');
check('快速添加只有一个名称框', await evaluate('!!document.querySelector("#quick-name") && !document.querySelector("#artifact-form")'));
check('快速添加不自动聚焦', await evaluate('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
await evaluate('document.querySelector("#quick-name").value = "涡纹"; document.querySelector("[data-action=quick-search]").click()');
await waitFor('!!document.querySelector(".quick-candidate")');
check('快速添加本地候选', (await evaluate('document.querySelector(".quick-candidate strong").innerText')).includes('涡纹'));
await evaluate('document.querySelector(".quick-candidate").click()');
await waitFor('!!document.querySelector("#quick-image-file")');
check('快速添加生成步骤', await evaluate('!!document.querySelector("[data-action=quick-generate]") && !!document.querySelector("[data-action=quick-pick-image]")'));
await evaluate('document.querySelector("[data-action=quick-manual]").click()');
await waitFor('!!document.querySelector("#f-name")');
check('添加表单已移除 AI 提示', await evaluate('!document.querySelector("#f-ai-instruction")'));
check('新增表单无笔记/时长/校对', await evaluate('!document.querySelector("#f-notes") && !document.querySelector("#f-duration") && !document.querySelector("#f-status")'));
check('完整手动填写不自动聚焦', await evaluate('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
await evaluate('document.querySelector("#f-name").value = "测试文物"; document.querySelector("#f-era").value = "测试年代"; document.querySelector("#f-summary").value = "这是一件用于测试的文物。"; document.querySelector("[data-action=save-with-ai]").click()');
await waitFor('!!document.querySelector("#ai-form")', 5000);
check('AI 面板保留提示框', await evaluate('!!document.querySelector("#ai-instruction")'));
await evaluate('document.querySelector("[data-action=close-modal]").click()');
await sleep(300);
await waitFor('location.hash.startsWith("#/a/")');
check('新增文物并进入详情', (await evaluate('document.querySelector(".artifact-title h1").innerText')) === '测试文物');
await evaluate('document.querySelector("[data-action=open-ai]").click()');
await waitFor('!!document.querySelector("#ai-paste")');
await evaluate('const payload={summary:"AI 简介",story:"AI 故事内容，直接叙述。",era:"AI 年代",material:"AI 材质",category:"AI 类别",size:"AI 尺寸",weight:"未知",unearthed:"AI 出土"}; document.querySelector("#ai-paste").value=JSON.stringify(payload); document.querySelector("[data-action=parse-ai]").click();');
await waitFor('!!document.querySelector(".ai-result")');
await evaluate('document.querySelector("[data-action=apply-ai]").click()');
await waitFor('!document.querySelector(".modal")');
await sleep(300);
const archiveText = await evaluate('document.querySelector(".archive-grid").innerText');
check('AI 补齐空白档案', archiveText.includes('AI 材质') && archiveText.includes('AI 类别') && archiveText.includes('AI 尺寸') && archiveText.includes('未知') && archiveText.includes('AI 出土'));
check('已有年代不被覆盖', archiveText.includes('测试年代') && !archiveText.includes('AI 年代'));

await evaluate('location.hash = "#/"');
await waitFor('document.querySelectorAll(".era-row").length === 8');
await evaluate('document.querySelector("[data-action=manage-galleries]").click()');
await waitFor('!!document.querySelector("#galleries-title")');
await evaluate('document.querySelector("[data-action=gallery-new]").click()');
await waitFor('!!document.querySelector("#g-name")');
await evaluate('document.querySelector("#g-name").value = "专题测试"; document.querySelector("#g-period").value = "2026"; document.querySelector("#gallery-form").requestSubmit()');
await sleep(400);
check('新增一级单元', (await evaluate('document.querySelectorAll(".era-row").length')) === 9);

await evaluate('location.hash = "#/a/a-houmuwu"');
await waitFor('!!document.querySelector(".artifact-title h1")');
await evaluate('document.querySelector("[data-action=open-ai]").click()');
await waitFor('!!document.querySelector("[data-action=offline-draft]")');
await evaluate('document.querySelector("[data-action=offline-draft]").click()');
await waitFor('!!document.querySelector(".ai-result")');
check('离线搭框架生成预览', (await evaluate('document.querySelector(".ai-result").innerText')).includes('最打动人的地方'));
await evaluate('document.querySelector("[data-action=apply-ai]").click()');
await waitFor('!document.querySelector(".modal")');
await sleep(300);
check('AI 草稿应用', (await evaluate('document.querySelector(".story-text").innerText')).length > 10);

await evaluate('location.hash = "#/"');
await waitFor('!!document.querySelector("#home-search")');
await evaluate('const i=document.querySelector("#home-search"); i.value="莲"; i.dispatchEvent(new Event("input",{bubbles:true}));');
await sleep(300);
check('搜索命中', (await evaluate('document.querySelectorAll(".search-hit").length')) >= 1);

await evaluate('location.hash = "#/review"');
await waitFor('!!document.querySelector("[data-action=review-reveal]")');
await evaluate('document.querySelector("[data-action=review-reveal]").click()');
await sleep(300);
check('复习翻开讲解故事', await evaluate('!!document.querySelector(".review-reveal")'));

await evaluate('location.hash = "#/settings"');
await waitFor('!!document.querySelector("#apiBase")');
await evaluate('document.querySelector("[data-action=use-deepseek]").click()');
await sleep(200);
check('DeepSeek 预设', (await evaluate('document.querySelector("#apiBase").value')) === 'https://api.deepseek.com/chat/completions' && (await evaluate('document.querySelector("#model").value')) === 'deepseek-flash');

await evaluate('location.hash = "#/g/g-yuan-gu"');
await waitFor('document.querySelectorAll(".artifact-row").length >= 3');
const dragOrder = await evaluate(`(function(){
  const rows = [...document.querySelectorAll('.artifact-row')];
  if (rows.length < 2) return 'short|short';
  const first = rows[0].querySelector('h3').innerText;
  const src = rows[1], dst = rows[0];
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const r = dst.getBoundingClientRect();
  dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientY: r.top + 2 }));
  dst.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  return first + '|' + document.querySelector('.artifact-row h3').innerText;
})()`);
check('拖动排序', dragOrder.split('|')[0] !== dragOrder.split('|')[1]);

const rowsBeforeDelete = await evaluate('document.querySelectorAll(".artifact-row").length');
await evaluate('document.querySelector(".artifact-row .card-menu-btn").click()');
await waitFor('!!document.querySelector(".card-menu-sheet")');
check('卡片菜单打开', await evaluate('!!document.querySelector(".card-menu-item.danger")'));
await evaluate('document.querySelector("[data-action=delete-card]").click()');
await waitFor(`document.querySelectorAll(".artifact-row").length === ${rowsBeforeDelete - 1}`);
check('卡片菜单删除生效', await evaluate('!!document.querySelector(".toast-action")'));
await evaluate('document.querySelector(".toast-action").click()');
await waitFor(`document.querySelectorAll(".artifact-row").length === ${rowsBeforeDelete}`);
check('三秒撤销恢复', await evaluate('document.querySelectorAll(".artifact-row").length') === rowsBeforeDelete);
check('长按菜单被拦截', await evaluate('(function(){var row=document.querySelector(".artifact-row"); var e=new MouseEvent("contextmenu",{bubbles:true,cancelable:true}); row.dispatchEvent(e); return e.defaultPrevented;})()'));

await evaluate('document.querySelector("[data-museum=capital]").click()');
await waitFor('document.documentElement.dataset.museum === "capital"');
check('切换到首博', await evaluate('document.querySelectorAll(".era-row").length === 11 && document.body.innerText.includes("首都博物馆")'));
await evaluate('document.querySelector(".era-row").click()');
await waitFor('document.querySelector(".gallery-hero h1").innerText === "青铜器"');
await evaluate('document.querySelector("[data-action=add-artifact]").click()');
await waitFor('!!document.querySelector("#catalog-search")');
await evaluate('document.querySelector("[data-action=catalog-scope][data-scope=all]").click()');
await waitFor('document.querySelectorAll(".catalog-row").length === 81');
check('首博名录 81 件', await evaluate('document.querySelector("#picker-title").innerText.includes("首博") && document.querySelectorAll(".catalog-row").length === 81'));
check('首博图片已带', await evaluate('document.querySelector(".catalog-thumb img").src.includes("assets/capital/")'));
await evaluate('document.querySelector(".catalog-row").click()');
await waitFor('!!document.querySelector("#f-name")');
check('首博条目自动填表', await evaluate('document.querySelector("#f-name").value === "伯矩鬲" && document.querySelector("#f-era").value.length > 0'));
check('首博条目图片路径', await evaluate('document.querySelector("#f-image").value.includes("assets/capital/")'));
await evaluate('document.querySelector("[data-action=close-modal]").click()');
await sleep(250);
await evaluate('document.querySelector(".museum-switch [data-museum=national]").click()');
await waitFor('document.documentElement.dataset.museum === "national" && document.querySelectorAll(".era-row").length === 9');
check('切回国博', await evaluate('document.querySelectorAll(".era-row").length === 9'));

const saved = await evaluate('JSON.stringify({len: (localStorage.getItem("guobo-guide-v1")||"").length})');
console.log('DATA', saved);
if (errors.length) console.log('JS ERRORS', errors.slice(0, 5));
const failed = results.filter((r) => !r.ok);
console.log('\nSUMMARY', results.length - failed.length + '/' + results.length + ' passed');
if (failed.length) process.exitCode = 1;
ws.close();
