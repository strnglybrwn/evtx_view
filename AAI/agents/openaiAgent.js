const https = require('https');
const fs = require('fs');
const path = require('path');

function readEnvFile() {
  try {
    const p = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(p)) return {};
    const txt = fs.readFileSync(p, 'utf8');
    const out = {};
    txt.split('\n').forEach(line => {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx+1).trim();
        out[k] = v;
      }
    });
    return out;
  } catch (e) { return {}; }
}

function findApiKey() {
  // check many places, do NOT return the key in outputs
  try {
    const secretStore = require('../lib/secretStore');
    const k1 = secretStore.get('OPENAI_API_KEY');
    if (k1) return k1;
    const k2 = secretStore.get('external_api_key');
    if (k2) return k2;
  } catch (e) {}
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_KEY) return process.env.OPENAI_KEY;
  const env = readEnvFile();
  if (env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  if (env.OPENAI_KEY) return env.OPENAI_KEY;
  return null;
}

async function run(input) {
  const key = findApiKey();
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

  return new Promise((resolve, reject) => {
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
    req.write(payload);
    req.end();
  });
}

function supports(input) {
  // prefer open-ended queries if key is present
  const key = findApiKey();
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
