import fs from 'node:fs';
import path from 'node:path';

const [url = 'http://127.0.0.1:4173', out = 'shot.png', w = '1440', h = '1000', wait = '2500', extra = ''] = process.argv.slice(2);
const width = Number(w), height = Number(h), delay = Number(wait);

const target = await (await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.text + ' ' + (msg.params.exceptionDetails?.exception?.description || ''));
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
function send(method, params = {}) {
  return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
}
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:4173', storageTypes: 'all' }).catch(() => {});
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, delay));
if (extra) {
  const r = await send('Runtime.evaluate', { expression: extra, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) errors.push(r.result.exceptionDetails.text);
  await new Promise((r2) => setTimeout(r2, 600));
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
const title = await send('Runtime.evaluate', { expression: 'document.title + " | " + document.body.innerText.slice(0,80).replace(/\\n/g," / ")', returnByValue: true });
console.log('saved', out, fs.statSync(out).size, 'bytes');
console.log('title', title.result?.result?.value);
if (errors.length) console.log('ERRORS', errors.slice(0, 8));
ws.close();
