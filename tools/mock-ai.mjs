import http from 'node:http';

const port = 4174;
const result = {
  summary: '一件用于验证 AI 流程的测试文物，重点看它如何把信息、故事和互动收进四段讲解。',
  facts: ['这是测试要点一', '这是测试要点二', '这是测试要点三'],
  script: {
    opening: '先请大家看这件测试文物。它最特别的地方，是让我们看见流程本身。',
    body: '这一段是测试主体。它应该被完整写回文物档案，而不是只停留在预览里。讲解词要口语、短句、能直接读出来。',
    highlight: '（指向器物）看这个细节：它证明 AI 结果可以被应用、再编辑。',
    closing: '这件测试文物就讲到这里。接下来，我们回到真正的展厅。'
  },
  tags: ['测试', 'AI流程'],
  duration: 2,
  sources: [{ title: '测试来源', url: 'https://example.com/test' }]
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
