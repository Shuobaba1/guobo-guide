import http from 'node:http';

const port = 4174;
const result = {
  summary: '一件用于验证 AI 流程的测试文物，重点看它如何把信息、故事和档案一次补齐。',
  story: '这件测试文物不大，却把一段流程留在了器身里。它的年代、材质和尺寸并不惊人，真正特别的是它让一次生成、预览和应用变得可以检查。\n\n器身上的细节很少，却足够说明问题：简介、故事和档案被放在同一份结果里，空着的字段会被补成“未知”，而不是被编造。\n\n它没有展厅里的灯光，也没有真实文物那样的重量，但它把一条完整链路走通了。',
  era: '测试年代',
  material: '测试材质',
  category: '测试类别',
  size: '测试尺寸',
  weight: '未知',
  unearthed: '测试出土地'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('no'); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    console.log('mock request', body.length, 'bytes');
    const payload = {
      id: 'mock-1',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(result) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 100, total_tokens: 110 }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
});
server.listen(port, '127.0.0.1', () => console.log('mock AI on ' + port));
