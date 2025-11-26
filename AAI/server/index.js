const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const exampleAgent = require('../agents/exampleAgent');
const duckAgent = require('../agents/duckduckgoAgent');
const openaiAgent = require('../agents/openaiAgent');

const app = express();
const port = process.env.PORT || 3000;

const secretStore = require('../lib/secretStore');
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_B64_LENGTH = Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3);

// allow larger JSON bodies for base64 attachments (phones can be several MB)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'web')));

// Graceful JSON parse / payload error handling: return JSON instead of HTML
app.use((err, req, res, next) => {
  if (!err) return next();
  // bodyParser too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  // invalid JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  // fallback to JSON error
  return res.status(err.status || 500).json({ error: String(err) });
});

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
  const streamStart = Date.now();

  // enumerate available agents and their metadata
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
    sendEvent(res, 'final', { result: final, agents: results, durationMs: Date.now() - streamStart });
    // indicate done then end
    sendEvent(res, 'done', {});
    setTimeout(() => res.end(), 100);
  }).catch(err => {
    sendEvent(res, 'error', { error: String(err), durationMs: Date.now() - streamStart });
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
  const preview = req.body && req.body.preview;
  const attachments = req.body && Array.isArray(req.body.attachments) ? req.body.attachments : [];
  if (attachments.length > MAX_ATTACHMENTS) {
    return res.status(400).json({ error: `too many attachments (max ${MAX_ATTACHMENTS})` });
  }
  const invalidAttachment = attachments.find(a => !a || typeof a.data !== 'string' || a.data.length > MAX_B64_LENGTH);
  if (invalidAttachment) {
    return res.status(400).json({ error: `attachment too large (max ~${Math.round(MAX_ATTACHMENT_BYTES/1024/1024)}MB each)` });
  }

  // debug log to help diagnose missing-input issues
  try {
    console.log('/api/solve called -- preview=', !!preview, 'hasInput=', typeof input === 'string' && input.trim().length > 0, 'attachments=', attachments.length);
  } catch (e) { }

  // accept either a non-empty input string OR at least one attachment
  const hasInput = (typeof input === 'string' && input.trim().length > 0);
  const hasAttachments = attachments.length > 0;
  if (!hasInput && !hasAttachments) {
    return res.status(400).json({ error: 'missing input or attachments' });
  }

  // If there are attachments but no textual input, run a simple image-analysis stub
  // instead of selecting a text agent. This avoids returning generic text agent greetings
  // when the user only provided images.
  if (!hasInput && hasAttachments) {
    try {
      const names = attachments.map(a => a.name || 'unnamed').join(', ');
      const out = `Received ${attachments.length} attachment(s): ${names}. Analysis: (stub) no faces detected, dominant color: yellow-ish.`;
      return res.json({ result: out, agents: [{ name: 'attachmentStub', output: out, metadata: { attachments: attachments.length } }], durationMs: 0, scored: [], rationale: 'Ran attachment analysis (stub) because no text input provided' });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  const start = Date.now();
  try {
    // enumerate and score agents
    const registered = [
      { name: 'openaiAgent', mod: openaiAgent },
      { name: 'exampleAgent', mod: exampleAgent },
      { name: 'duckduckgoAgent', mod: duckAgent }
    ];
    const scored = registered.map(r => ({ name: r.name, score: (typeof r.mod.supports === 'function') ? r.mod.supports(input) : 0, mod: r.mod }));
  const suitableAll = scored.filter(s => s.score >= 0.6).sort((a,b) => b.score - a.score);
  const suitable = suitableAll.length ? [suitableAll[0]] : [];

    // If client asked for preview, return scoring and rationale without running agents
    if (preview) {
    return res.json({ scored, suitable: suitable.map(s => ({ name: s.name, score: s.score })), rationale: suitable.length ? `Selected ${suitable[0].name} with score ${suitable[0].score}` : 'No candidate reached threshold', attachments: attachments.length });
  }

  if (suitable.length === 0) {
      const infer = (q) => {
        const needs = [];
        const lower = q.toLowerCase();
        if (/image|photo|picture|face|faces|detect/.test(lower)) needs.push('image-analysis');
        if (/file|upload|attachment/.test(lower)) needs.push('file-upload');
        if (needs.length === 0) needs.push('internet-access');
        return needs;
      };
      const needs = infer(input || (hasAttachments ? 'attachment' : ''));
  return res.json({ result: null, agents: [], message: 'No suitable agent found for this query', needs, scored, attachments: attachments.length });
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
  if (provided.attachments.length > MAX_ATTACHMENTS) {
    return res.status(400).json({ error: `too many attachments (max ${MAX_ATTACHMENTS})` });
  }
  const invalidAttachment = provided.attachments.find(a => !a || typeof a.data !== 'string' || a.data.length > MAX_B64_LENGTH);
  if (invalidAttachment) {
    return res.status(400).json({ error: `attachment too large (max ~${Math.round(MAX_ATTACHMENT_BYTES/1024/1024)}MB each)` });
  }

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
  try {
    secretStore.set('external_api_key', apiKey);
    console.warn('Persisting provided apiKey to .env.local (plaintext) for development only.');
  } catch (e) {}
    // Reuse POST /api/solve logic
    try {
      // enumerate and score agents
      const registered = [
        { name: 'openaiAgent', mod: openaiAgent },
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
