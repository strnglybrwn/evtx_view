const https = require('https');

const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 300;

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function findApiKey(overrideKey) {
  // Runtime key can be passed per request; never persisted.
  if (typeof overrideKey === 'string' && overrideKey.trim()) return overrideKey.trim();
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_KEY) return process.env.OPENAI_KEY;
  return null;
}

async function run(input, context = {}) {
  const key = findApiKey(context.apiKey);
  if (!key) throw new Error('missing OpenAI API key');

  const payload = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: input }],
    max_tokens: 300
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': `Bearer ${key}`
    }
  };

  const sendRequest = () => new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || (j.error && j.error.message) || '';
          if (j.error) return reject(new Error(j.error.message || 'openai error'));
          resolve({ output: text.trim(), metadata: { model: 'gpt-3.5-turbo' } });
        } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('openai request timeout')));
    req.write(payload);
    req.end();
  });

  try {
    return await sendRequest();
  } catch (err) {
    // simple single retry on timeout/transient network errors
    const msg = String(err || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('ecconnreset') || msg.includes('econnreset')) {
      await delay(RETRY_DELAY_MS);
      return await sendRequest();
    }
    throw err;
  }
}

function supports(input, context = {}) {
  // prefer open-ended queries if key is present
  const key = findApiKey(context.apiKey);
  if (!key) return 0;
  // heuristics: if input length > 20 or contains question words, it's suitable
  const q = (input || '').toLowerCase();
  const questionWords = ['who', 'what', 'when', 'where', 'why', 'how'];
  if (questionWords.some(w => q.startsWith(w))) return 0.9;
  if (q.length > 20) return 0.85;
  return 0.7;
}

const requirements = ['openai_api_key'];

module.exports = { run, supports, requirements };
