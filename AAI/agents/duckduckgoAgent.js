const https = require('https');

const REQUEST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 300;

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function fetchInstantAnswer(q) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('duckduckgo request timeout')));
  });
}

async function run(input) {
  // Call DuckDuckGo Instant Answer API and return a short text summary
  let json;
  try {
    json = await fetchInstantAnswer(input);
  } catch (err) {
    // retry once for transient failures
    await delay(RETRY_DELAY_MS);
    json = await fetchInstantAnswer(input);
  }
  // Prefer AbstractText, then RelatedTopics first text, then Answer
  let output = '';
  if (json.AbstractText) output = json.AbstractText;
  else if (Array.isArray(json.RelatedTopics) && json.RelatedTopics.length) {
    const first = json.RelatedTopics[0];
    output = first.Text || (first.Topics && first.Topics[0] && first.Topics[0].Text) || '';
  } else if (json.Answer) output = json.Answer;
  else output = json.Heading || '';

  if (!output) output = 'No concise instant answer found.';

  return { output, metadata: { source: 'duckduckgo', heading: json.Heading || null } };
}

module.exports = { run };

// Capability: web lookup via DuckDuckGo instant answer — best for factual queries about entities
function supports(input) {
  // very naive heuristic: if input contains a noun-like word or short query, score higher
  if (!input || typeof input !== 'string') return 0;
  const q = input.toLowerCase();
  // prefer short topical queries (no question words)
  const questionWords = ['who', 'what', 'when', 'where', 'why', 'how'];
  if (questionWords.some(w => q.startsWith(w))) return 0.6;
  // if the query mentions image processing, avoid selecting this agent
  const imageWords = ['image', 'face', 'faces', 'detect', 'analyze the image', 'photo', 'picture'];
  if (imageWords.some(w => q.includes(w))) return 0.2;
  if (q.length < 80) return 0.8;
  return 0.4;
}

const requirements = ['internet-access'];

module.exports = { run, supports, requirements };
