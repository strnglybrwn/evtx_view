const form = document.getElementById('form');
const input = document.getElementById('input');
const result = document.getElementById('result');
// agentsContainer removed; combined result will include agent outputs
const needsPrompt = document.getElementById('needsPrompt');
const selectionPanel = document.getElementById('selectionPanel');
const pastePreview = document.getElementById('pastePreview');

// attachments captured from paste (array of {name,type,data})
const attachments = [];

// capture pasted images from the textarea
input.addEventListener('paste', async (ev) => {
  try {
    const items = ev.clipboardData && ev.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && it.type && it.type.indexOf('image') === 0) {
        const blob = it.getAsFile();
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const ext = (it.type.split('/')[1] || 'png').replace(/[^a-z0-9]/g, '')
        const name = `pasted-${Date.now()}.${ext}`;
        attachments.push({ name, type: it.type, data: b64 });
      }
    }
    renderPastePreview();
  } catch (err) {
    console.warn('paste handling failed', err);
  }
});

function renderPastePreview(){
  if (!pastePreview) return;
  pastePreview.innerHTML = '';
  attachments.forEach((att, idx) => {
    const w = document.createElement('div'); w.style.position='relative';
    const img = document.createElement('img'); img.src = `data:${att.type};base64,${att.data}`;
    img.style.maxWidth='120px'; img.style.maxHeight='90px'; img.style.borderRadius='6px';
    const btn = document.createElement('button'); btn.textContent='✕';
    btn.style.position='absolute'; btn.style.top='-6px'; btn.style.right='-6px'; btn.style.padding='3px 6px';
    btn.onclick = () => { attachments.splice(idx,1); renderPastePreview(); };
    w.appendChild(img); w.appendChild(btn); pastePreview.appendChild(w);
  });
  // update controls
  const removeAllBtn = document.getElementById('removeAllBtn');
  const attachIndicator = document.getElementById('attachIndicator');
  if (removeAllBtn) removeAllBtn.style.display = attachments.length ? 'inline-block' : 'none';
  if (attachIndicator) attachIndicator.style.display = attachments.length ? 'inline' : 'none';
}

// remove all attachments
const removeAllBtnEl = document.getElementById('removeAllBtn');
if (removeAllBtnEl) removeAllBtnEl.addEventListener('click', () => { attachments.splice(0, attachments.length); renderPastePreview(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setResult('Loading...');
  try {
    const payload = { input: input.value };
    if (attachments.length) payload.attachments = attachments;
    const resp = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
    // show scoring info
    showScoredResponse(body);
    // append agent outputs into the combined result in a readable way
    const combined = (body.result) ? body.result : (body.agents || []).map(a => a.output || '').join('\n\n');
    setResult(combined);
  } catch (err) {
    setResult('Error: ' + String(err));
  }
});

// SSE/live updates removed — only POST flow is used now

// Show a simple prompt to the user when the server says capabilities are needed
function showNeedsPrompt(needs) {
  needsPrompt.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'box';
  box.innerHTML = `<div><strong>To answer this question we need:</strong> ${needs.join(', ')}</div>`;
  // for image-analysis, offer a file input
  if (needs.includes('image-analysis')) {
    const file = document.createElement('input');
    file.type = 'file';
    box.appendChild(file);
    const btn = document.createElement('button');
    btn.textContent = 'Provide and retry';
    btn.onclick = async () => {
      if (!file.files || file.files.length === 0) return alert('Select a file');
      const f = file.files[0];
      const buf = await f.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      // POST to provide endpoint with attachments
      const resp = await fetch('/api/provide', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input: input.value, attachments: [{ name: f.name, data: b64, type: f.type }], needs }) });
      const body = await resp.json();
      if (body && body.ran) setResult(body.result || '(no result)');
      else alert('Provider response: ' + JSON.stringify(body));
    };
  box.appendChild(document.createElement('br'));
    box.appendChild(btn);
  }
  // for api keys or internet-access, offer a text input
  if (needs.includes('internet-access') || needs.includes('api-key') || needs.includes('file-upload')) {
    const txt = document.createElement('input');
    txt.placeholder = 'Paste API key or info (optional)';
    txt.style = 'display:block;margin-top:.5rem;width:100%';
    box.appendChild(txt);
    const btn2 = document.createElement('button');
    btn2.textContent = 'Provide and retry';
    btn2.onclick = async () => {
      const resp = await fetch('/api/provide', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input: input.value, apiKey: txt.value, needs }) });
      const body = await resp.json();
      if (body && body.ran) setResult(body.result || '(no result)');
      else alert('Provider response: ' + JSON.stringify(body));
    };
    box.appendChild(btn2);
  }
  needsPrompt.appendChild(box);
}

function showSelectionScores(list) {
  // Render score rows with bars and badges
  selectionPanel.innerHTML = '';
  const title = document.createElement('div'); title.textContent = 'Agent suitability'; selectionPanel.appendChild(title);
  list.forEach(s => {
    const row = document.createElement('div'); row.className = 'score-row';
    const name = document.createElement('div'); name.className = 'score-name'; name.textContent = s.name;
    const wrap = document.createElement('div'); wrap.className = 'score-bar-wrap';
    const bar = document.createElement('div'); bar.className = 'score-bar'; bar.style.width = `${Math.min(100, Math.round(s.score * 100))}%`;
    wrap.appendChild(bar);
    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = `${(s.score*100).toFixed(0)}%`;
    row.appendChild(name); row.appendChild(wrap); row.appendChild(badge);
    selectionPanel.appendChild(row);
  });
}

function showRationale(text) {
  const el = document.createElement('div'); el.style.marginTop='6px'; el.style.color='var(--muted)'; el.textContent = 'Selection: ' + text; selectionPanel.appendChild(el);
}

// For non-SSE responses
function showScoredResponse(json) {
  if (!json) return;
  if (json.scored) showSelectionScores(json.scored.map(s => ({ name: s.name, score: s.score })));
  if (json.rationale) showRationale(json.rationale);
}

// UI helpers
function setResult(value) {
  // Accept either a string or an updater function (prev => newText)
  if (typeof value === 'function') {
    const prev = result.textContent || '';
    const next = value(prev) || '';
    result.textContent = next;
  } else {
    result.textContent = value || '';
  }
}
