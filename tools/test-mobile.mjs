const target = await (await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
function send(method, params = {}) {
  return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
}
async function waitFor(expr, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await ev(expr)) return true;
    await sleep(150);
  }
  return false;
}
let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:4173', storageTypes: 'all' }).catch(() => {});
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: 'http://127.0.0.1:4173#/' });
await sleep(2800);

check('手机首页 8 个单元', await ev('document.querySelectorAll(".era-row").length === 8'));
check('无横向溢出', await ev('document.documentElement.scrollWidth <= innerWidth + 1'));
check('底部导航显示', await ev('getComputedStyle(document.querySelector(".bottom-nav")).display !== "none"'));
check('搜索框 16px 防缩放', (await ev('getComputedStyle(document.querySelector(".search-box input")).fontSize')) === '16px');
check('Service Worker 已注册', await ev('navigator.serviceWorker.ready.then((r) => !!r.active)'));
check('离线缓存版本 v24', await ev('caches.keys().then((keys) => keys.includes("guobo-guide-v24"))'));

await ev('document.querySelector(".era-row").click()');
await waitFor('!!document.querySelector(".artifact-row")');
check('手机单元页单栏', await ev('!document.querySelector(".split-layout")'));
check('手机顶部添加按钮', await ev('!!document.querySelector(".gallery-toolbar [data-action=add-artifact]")'));
check('手机卡片菜单', await ev('!!document.querySelector(".card-menu-btn")'));
check('手机卡片不启用拖拽', await ev('document.querySelector(".artifact-row").draggable === false'));
check('手机长按菜单被拦截', await ev('(function(){var row=document.querySelector(".artifact-row"); var e=new MouseEvent("contextmenu",{bubbles:true,cancelable:true}); row.dispatchEvent(e); return e.defaultPrevented;})()'));
await ev('document.querySelector(".card-menu-btn").click()');
await waitFor('!!document.querySelector(".card-menu-sheet")');
check('手机卡片菜单可打开', await ev('!!document.querySelector("[data-action=delete-card]")'));
await ev('document.querySelector("[data-action=close-modal]").click()');
await sleep(150);
check('手机打开单元不自动聚焦', await ev('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
check('手机无校对入口', await ev('!document.body.innerText.includes("待校对") && !document.querySelector(".status")'));
check('排序入口存在', await ev('!!document.querySelector(".sort-toggle")'));
const before = await ev('document.querySelector(".artifact-row h3").innerText');
await ev('document.querySelector(".sort-toggle").click()');
await sleep(250);
check('排序模式有 ↑↓', await ev('document.querySelectorAll(".sort-controls").length > 0'));
await ev('document.querySelector(".artifact-row [data-action=move-down]").click()');
await sleep(250);
const after = await ev('document.querySelector(".artifact-row h3").innerText');
check('排序确实改变顺序', after !== before);
await ev('document.querySelectorAll(".artifact-row")[1].querySelector("[data-action=move-up]").click()');
await sleep(250);
check('排序可恢复', (await ev('document.querySelector(".artifact-row h3").innerText')) === before);
await ev('document.querySelector(".sort-toggle").click()');
await sleep(200);
await ev('document.querySelector(".artifact-row").click()');
await waitFor('location.hash.startsWith("#/a/")');
check('手机点文物进单页详情', (await ev('document.querySelector(".artifact-title h1").innerText')).includes('鹳鱼石斧'));
check('详情无分栏', await ev('!document.querySelector(".split-layout")'));

await ev('document.querySelector("[data-action=open-reader]").click()');
await waitFor('!!document.querySelector(".reader")');
check('手机讲解模式可打开', await ev('(document.querySelector(".reader-text")||{innerText:""}).innerText.length > 30'));
await ev('document.querySelector("[data-action=close-reader]").click()');
await sleep(200);

await ev('location.hash="#/g/g-yuan-gu"');
await waitFor('!!document.querySelector("[data-action=add-artifact]")');
await ev('document.querySelector("[data-action=add-artifact]").click()');
await waitFor('!!document.querySelector(".modal")');
await sleep(450);
check('添加弹窗不超出屏幕', await ev('document.querySelector(".modal").getBoundingClientRect().bottom <= innerHeight + 1'));
check('手机添加不自动聚焦', await ev('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
check('名录搜索框 16px', (await ev('getComputedStyle(document.querySelector("#catalog-search")).fontSize')) === '16px');
await ev('document.querySelector("[data-action=manual-fill]").click()');
await waitFor('!!document.querySelector("#quick-name")');
check('手机快速添加名称框', await ev('!!document.querySelector("#quick-name") && !document.querySelector("#artifact-form")'));
check('手机快速添加不自动聚焦', await ev('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
await ev('document.querySelector("#quick-name").value="涡纹"; document.querySelector("[data-action=quick-search]").click()');
await waitFor('!!document.querySelector(".quick-candidate")');
check('手机快速添加候选', await ev('document.querySelectorAll(".quick-candidate").length > 0'));
await ev('document.querySelector(".quick-candidate").click()');
await waitFor('!!document.querySelector("#quick-image-file")');
check('手机快速添加生成步骤', await ev('!!document.querySelector("[data-action=quick-generate]")'));
await ev('document.querySelector("[data-action=quick-manual]").click()');
await waitFor('!!document.querySelector("#f-name")');
check('手机添加表单已移除 AI 提示', await ev('!document.querySelector("#f-ai-instruction")'));
check('手机新增表单精简', await ev('!document.querySelector("#f-notes") && !document.querySelector("#f-duration") && !document.querySelector("#f-status")'));
check('手机添加不自动聚焦', await ev('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'));
check('表单输入 16px', (await ev('getComputedStyle(document.querySelector("#f-name")).fontSize')) === '16px');
await ev('document.querySelector("[data-action=close-modal]").click()');
await sleep(200);

await ev('location.hash="#/settings"');
await sleep(500);
check('设置里有 iPhone 安装说明', await ev('document.body.innerText.includes("iPhone")'));
check('设置页可切底色', await ev('document.querySelectorAll(".settings-theme .theme-swatch").length === 4'));

await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:4173#/g/g-yuan-gu/a/a-guanyu' });
await sleep(1200);
check('iPhone 横屏仍单页', await ev('!document.querySelector(".split-layout") && location.hash.startsWith("#/a/")'));

await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 1000, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:4173#/g/g-yuan-gu' });
await sleep(1000);
check('折叠屏 800 宽仍分栏', await ev('!!document.querySelector(".split-layout")'));

console.log('\nSUMMARY ' + passed + '/' + (passed + failed) + ' passed');
ws.close();
process.exit(failed ? 1 : 0);
