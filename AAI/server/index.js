const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const exampleAgent = require('../agents/exampleAgent');
const duckAgent = require('../agents/duckduckgoAgent');

const app = express();
const port = process.env.PORT || 3000;

const secretStore = require('../lib/secretStore');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// Simple health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Server-Sent Events endpoint: streams agent activity live
function sendEvent(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  } catch (err) {
    // ignore write errors (client gone)
  }
}

app.get('/api/solve-stream', async (req, res) => {
  const input = req.query && req.query.input;
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'missing input (use ?input=...)' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // enumerate available agents and their metadata
  const openaiAgent = require('../agents/openaiAgent');
  const registered = [
    { name: 'openaiAgent', mod: openaiAgent },
    { name: 'exampleAgent', mod: exampleAgent },
    { name: 'duckduckgoAgent', mod: duckAgent }
  ];

    // score agents by supports() and pick suitable ones
    const scored = registered.map(r => ({ name: r.name, score: (typeof r.mod.supports === 'function') ? r.mod.supports(input) : 0, mod: r.mod }));
    // stream each agent's score for UI visibility
    scored.forEach(s => sendEvent(res, 'agent-score', { name: s.name, score: s.score }));
    const suitableAll = scored.filter(s => s.score >= 0.6).sort((a,b) => b.score - a.score);

  // choose the single top agent only
  const suitable = suitableAll.length ? [suitableAll[0]] : [];

  // if none suitable, inform the client what is missing
  if (suitable.length === 0) {
    // infer needs from question
    const infer = (q) => {
      const needs = [];
      const lower = q.toLowerCase();
      if (/image|photo|picture|face|faces|detect/.test(lower)) needs.push('image-analysis');
      if (/file|upload|attachment/.test(lower)) needs.push('file-upload');
      if (needs.length === 0) needs.push('internet-access');
      return needs;
    };
    const needs = infer(input);
    sendEvent(res, 'selection', { selected: [], message: 'No suitable agent found', needs });
    sendEvent(res, 'final', { result: 'No suitable agent could be selected for this question. Requirements needed: ' + (needs.join(', ') || 'none'), agents: [] });
    sendEvent(res, 'done', {});
    return res.end();
  }

    // include rationale: top candidate and why it was chosen
    sendEvent(res, 'selection', { selected: suitable.map(s => ({ name: s.name, score: s.score })), rationale: suitable.length ? `Selected ${suitable[0].name} with score ${suitable[0].score}` : 'No candidate reached threshold' });

  const runners = suitable.map(s => ({ name: s.name, fn: s.mod.run }));

  // start all agents in parallel and stream their events
  const promises = runners.map(r => (async () => {
    sendEvent(res, 'agent-start', { name: r.name });
    const t0 = Date.now();
    try {
      const out = await r.fn(input);
      const durationMs = Date.now() - t0;
      sendEvent(res, 'agent-done', { name: r.name, output: out.output, metadata: out.metadata || {}, durationMs });
      return { name: r.name, output: out.output, metadata: out.metadata || {}, durationMs };
    } catch (err) {
      const durationMs = Date.now() - t0;
      sendEvent(res, 'agent-error', { name: r.name, error: String(err), durationMs });
      return { name: r.name, error: String(err), durationMs };
    }
  })());

  // When all agents finish send final event and close stream
  Promise.all(promises).then(results => {
    const final = results.map(r => r.output || (`[${r.name} error] ${r.error || 'no output'}`)).join('\n\n');
    sendEvent(res, 'final', { result: final, agents: results, durationMs: Date.now() });
    // indicate done then end
    sendEvent(res, 'done', {});
    setTimeout(() => res.end(), 100);
  }).catch(err => {
    sendEvent(res, 'error', { error: String(err) });
    setTimeout(() => res.end(), 100);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    try { res.end(); } catch (e) {}
  });
});

// Main API: orchestrator that calls agents
app.post('/api/solve', async (req, res) => {
  const input = req.body && req.body.input;
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'missing input' });
  }

  const start = Date.now();
  try {
    // enumerate and score agents
    const openaiAgent = require('../agents/openaiAgent');
    const registered = [
      { name: 'openaiAgent', mod: openaiAgent },
      { name: 'exampleAgent', mod: exampleAgent },
      { name: 'duckduckgoAgent', mod: duckAgent }
    ];
  const scored = registered.map(r => ({ name: r.name, score: (typeof r.mod.supports === 'function') ? r.mod.supports(input) : 0, mod: r.mod }));
  const suitableAll = scored.filter(s => s.score >= 0.6).sort((a,b) => b.score - a.score);
  const suitable = suitableAll.length ? [suitableAll[0]] : [];

  if (suitable.length === 0) {
      const infer = (q) => {
        const needs = [];
        const lower = q.toLowerCase();
        if (/image|photo|picture|face|faces|detect/.test(lower)) needs.push('image-analysis');
        if (/file|upload|attachment/.test(lower)) needs.push('file-upload');
        if (needs.length === 0) needs.push('internet-access');
        return needs;
      };
      const needs = infer(input);
  return res.json({ result: null, agents: [], message: 'No suitable agent found for this query', needs, scored });
    }

  const runners = suitable.map(s => ({ name: s.name, fn: s.mod.run }));
    const results = await Promise.all(runners.map(async r => {
      const aStart = Date.now();
      try {
        const out = await r.fn(input);
        return { name: r.name, output: out.output, durationMs: Date.now() - aStart, metadata: out.metadata || {} };
      } catch (err) {
        return { name: r.name, error: String(err), durationMs: Date.now() - aStart };
      }
    }));

  const result = results.map(r => r.output || (`[${r.name} error] ${r.error || 'no output'}`)).join('\n\n');
  res.json({ result, agents: results, durationMs: Date.now() - start, scored, rationale: suitable.length ? `Selected ${suitable[0].name} with score ${suitable[0].score}` : 'No candidate reached threshold' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Accept provided resources (files, apiKey) and attempt to run agents if requirements are met
app.post('/api/provide', async (req, res) => {
  const { input, attachments, apiKey, needs } = req.body || {};
  if (!input) return res.status(400).json({ error: 'missing input' });

  // Simple check: if attachments provided and need includes image-analysis, run a fake image agent
  const provided = { attachments: attachments || [], apiKey };

  // For this prototype, if attachments exist and needs includes image-analysis, pretend we have an image agent
  if (needs && needs.includes('image-analysis') && provided.attachments.length > 0) {
    // run a trivial image-analysis stub (synchronous)
    const out = `Received ${provided.attachments.length} attachment(s). Analysis: no faces detected (stub).`;
    return res.json({ ran: true, result: out });
  }

  // If apiKey provided and needs included internet-access, accept and rerun existing agents
  if (needs && needs.includes('internet-access') && apiKey) {
    // In this minimal prototype we don't actually use the key, but will re-run the normal selection
  // persist the provided key in the transient secret store under a well-known key
  try { secretStore.set('external_api_key', apiKey); } catch (e) {}
    // Reuse POST /api/solve logic
    try {
      // enumerate and score agents
      const registered = [
        { name: 'exampleAgent', mod: exampleAgent },
        { name: 'duckduckgoAgent', mod: duckAgent }
      ];
      const scored = registered.map(r => ({ name: r.name, score: (typeof r.mod.supports === 'function') ? r.mod.supports(input) : 0, mod: r.mod }));
      const suitable = scored.filter(s => s.score >= 0.6).sort((a,b) => b.score - a.score);
      if (suitable.length === 0) return res.json({ ran: false, message: 'Still no suitable agent after providing apiKey' });
      const runners = suitable.map(s => ({ name: s.name, fn: s.mod.run }));
      const results = await Promise.all(runners.map(async r => {
        try { const out = await r.fn(input); return { name: r.name, output: out.output }; } catch (e) { return { name: r.name, error: String(e) }; }
      }));
      const final = results.map(r => r.output || (`[${r.name} error] ${r.error || 'no output'}`)).join('\n\n');
      return res.json({ ran: true, result: final, agents: results });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.json({ ran: false, message: 'No actionable resources provided' });
});

app.listen(port, () => {
  console.log(`AAI server listening on http://localhost:${port}`);
});
