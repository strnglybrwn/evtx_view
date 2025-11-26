// Client main script: handles paste/drop attachments, preview, submit + SSE streaming
const input = document.getElementById('input');
const form = document.getElementById('form');
const result = document.getElementById('result');
const pastePreview = document.getElementById('pastePreview');
const selectionPanel = document.getElementById('selectionPanel');
const removeAllBtn = document.getElementById('removeAllBtn');
const attachIndicator = document.getElementById('attachIndicator');

// attachments: {name, type, data (base64)}
const attachments = [];

function setResult(text){
  try{
    if (typeof text === 'function') {
      const prev = result.textContent || '';
      result.textContent = text(prev);
    } else {
      result.textContent = text;
    }
  }catch(e){ console.warn(e); }
}

function showScoredResponse(body){
  if (!selectionPanel) return;
  selectionPanel.innerHTML = '';
  const title = document.createElement('div');
  title.style.marginBottom='8px';
  title.style.color='var(--muted)';
  title.textContent = body.rationale || 'Agent suitability';
  selectionPanel.appendChild(title);
  const scored = body.scored || body.selected || [];
  scored.forEach(s => {
    const row = document.createElement('div'); row.className='score-row';
    const name = document.createElement('div'); name.className='score-name'; name.textContent = s.name;
    const wrap = document.createElement('div'); wrap.className='score-bar-wrap';
    const bar = document.createElement('div'); bar.className='score-bar'; bar.style.width = Math.round((s.score||0)*100)+'%';
    wrap.appendChild(bar);
    const badge = document.createElement('div'); badge.className='badge'; badge.textContent = Math.round((s.score||0)*100)+'%';
    row.appendChild(name); row.appendChild(wrap); row.appendChild(badge);
    selectionPanel.appendChild(row);
  });
}

function renderPastePreview(){
  if (!pastePreview) return;
  pastePreview.innerHTML = '';
  attachments.forEach((att, idx) => {
    const wrapper = document.createElement('div'); wrapper.style.position='relative'; wrapper.style.display='inline-block';
    const img = document.createElement('img'); img.style.maxWidth='120px'; img.style.maxHeight='90px'; img.style.borderRadius='6px'; img.src = `data:${att.type};base64,${att.data}`;
    const btn = document.createElement('button'); btn.textContent='✕'; btn.setAttribute('aria-label','Remove');
    btn.style.position='absolute'; btn.style.top='-6px'; btn.style.right='-6px'; btn.style.padding='3px 6px'; btn.style.borderRadius='6px'; btn.style.border='none'; btn.style.cursor='pointer';
    btn.onclick = () => { attachments.splice(idx,1); renderPastePreview(); };
    wrapper.appendChild(img); wrapper.appendChild(btn); pastePreview.appendChild(wrapper);
  });
  // update controls visibility
  if (removeAllBtn) removeAllBtn.style.display = attachments.length ? 'inline-block' : 'none';
  if (attachIndicator) attachIndicator.style.display = attachments.length ? 'inline' : 'none';
}

function handleImageFile(file){
  return new Promise((res, rej) => {
    try{
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result || '';
        // data:[<mediatype>][;base64],<data>
        const parts = dataUrl.split(',');
        const b64 = parts[1] || '';
        const type = file.type || 'image/png';
        const ext = (type.split('/')[1]||'png').replace(/[^a-z0-9]/g,'');
        const name = file.name || `pasted-${Date.now()}.${ext}`;
        attachments.push({ name, type, data: b64 });
        renderPastePreview();
        res();
      };
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(file);
    }catch(e){ rej(e); }
  });
}

// Paste handler
if (input) {
  input.addEventListener('paste', async (ev) => {
    try{
      const items = ev.clipboardData && ev.clipboardData.items;
      if (items) {
        for (let i=0;i<items.length;i++){
          const it = items[i];
          if (!it) continue;
          if (it.kind === 'file') {
            const f = it.getAsFile(); if (f && f.type && f.type.startsWith('image')) await handleImageFile(f);
          } else if (it.type && it.type.startsWith('image')) {
            const blob = it.getAsFile(); if (blob) await handleImageFile(blob);
          }
        }
      } else if (ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length) {
        for (let f of ev.clipboardData.files) if (f.type && f.type.startsWith('image')) await handleImageFile(f);
      }
    }catch(err){ console.warn('paste handling failed', err); }
  });

  // Drag & drop support
  input.addEventListener('dragover', (e)=>{ e.preventDefault(); input.classList.add('dragover'); });
  input.addEventListener('dragleave', (e)=>{ e.preventDefault(); input.classList.remove('dragover'); });
  input.addEventListener('drop', async (e)=>{
    e.preventDefault(); input.classList.remove('dragover');
    try{
      const files = e.dataTransfer && e.dataTransfer.files; if (!files) return;
      for (let i=0;i<files.length;i++){ const f = files[i]; if (f && f.type && f.type.startsWith('image')) await handleImageFile(f); }
    }catch(err){ console.warn('drop failed', err); }
  });
}

if (removeAllBtn) removeAllBtn.addEventListener('click', ()=>{ attachments.splice(0, attachments.length); renderPastePreview(); });

// Submit flow: preview then open SSE stream for live updates
if (form) form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setResult('Analyzing suitability...');
  try{
    const previewPayload = { input: input.value, preview: true };
    if (attachments.length) previewPayload.attachments = attachments;
    const previewResp = await fetch('/api/solve',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(previewPayload)});
    const previewBody = await previewResp.json();
    if (!previewResp.ok) throw new Error(previewBody.error || JSON.stringify(previewBody));
    showScoredResponse(previewBody);

    // open SSE stream for live progress of selected agent
    setResult('Opening live stream for selected agent...');
    const esUrl = `/api/solve-stream?input=${encodeURIComponent(input.value)}`;
    const es = new EventSource(esUrl);
    es.addEventListener('agent-score', (ev)=>{ try{ const d=JSON.parse(ev.data); /* optionally update */ }catch(e){} });
    es.addEventListener('selection', (ev)=>{ try{ const d=JSON.parse(ev.data); showScoredResponse({ scored: d.selected, rationale: d.rationale || d.message }); }catch(e){} });
    es.addEventListener('agent-start', (ev)=>{ try{ const d=JSON.parse(ev.data); setResult(prev=> (prev?prev+'\n\n':'')+`[${d.name}] started...`); }catch(e){} });
    es.addEventListener('agent-done', (ev)=>{ try{ const d=JSON.parse(ev.data); setResult(prev=> (prev?prev+'\n\n':'')+`[${d.name}] ${d.output||''}`); }catch(e){} });
    es.addEventListener('agent-error', (ev)=>{ try{ const d=JSON.parse(ev.data); setResult(prev=> (prev?prev+'\n\n':'')+`[${d.name} error] ${d.error||''}`); }catch(e){} });
    es.addEventListener('final', (ev)=>{ try{ const d=JSON.parse(ev.data); if (d && d.result) setResult(d.result); }catch(e){} });
    es.addEventListener('done', ()=>{ try{ es.close(); }catch(e){} });

  }catch(err){ setResult('Error: '+String(err)); }
});

// initial render state
renderPastePreview();
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
async function handleImageFile(file){
  try{
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/g, '');
    const name = `pasted-${Date.now()}.${ext}`;
    attachments.push({ name, type: file.type || 'image/png', data: b64 });
    renderPastePreview();
  }catch(e){ console.warn('file->b64 failed', e); }
}

input.addEventListener('paste', async (ev) => {
  try {
    const items = ev.clipboardData && ev.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it) continue;
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f && f.type && f.type.indexOf('image') === 0) await handleImageFile(f);
        } else if (it.type && it.type.indexOf('image') === 0) {
          const blob = it.getAsFile(); if (blob) await handleImageFile(blob);
        }
      }
    } else if (ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length) {
      for (let f of ev.clipboardData.files) if (f.type && f.type.indexOf('image')===0) await handleImageFile(f);
    }
  } catch (err) {
    console.warn('paste handling failed', err);
  }
});

// drag & drop support on the textarea
input.addEventListener('dragover', (e)=>{ e.preventDefault(); input.classList.add('dragover'); });
input.addEventListener('dragleave', (e)=>{ e.preventDefault(); input.classList.remove('dragover'); });
input.addEventListener('drop', async (e)=>{
  e.preventDefault(); input.classList.remove('dragover');
  try{
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files) return;
    for (let i=0;i<files.length;i++){ const f = files[i]; if (f.type && f.type.indexOf('image')===0) await handleImageFile(f); }
  }catch(err){ console.warn('drop failed', err); }
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
  // Step 1: request a preview (scoring only)
  setResult('Analyzing suitability...');
  try {
    const previewPayload = { input: input.value, preview: true };
    if (attachments.length) previewPayload.attachments = attachments;
    const previewResp = await fetch('/api/solve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewPayload) });
    const previewBody = await previewResp.json();
    if (!previewResp.ok) throw new Error(previewBody.error || JSON.stringify(previewBody));
    // show suitability UI
    showScoredResponse(previewBody);
    // now open an SSE connection for the selected agent's live progress
    setResult('Opening live stream for selected agent...');
    // add enter animation to selection panel
    selectionPanel.classList.add('fade-enter');
    setTimeout(() => selectionPanel.classList.add('fade-enter-active'), 20);
    // open EventSource to stream events (server emits agent-score, selection, agent-start, agent-done, final)
    const esUrl = `/api/solve-stream?input=${encodeURIComponent(input.value)}`;
    const es = new EventSource(esUrl);
    es.addEventListener('agent-score', (ev) => {
      // optional: update selection UI if needed
      try { const d = JSON.parse(ev.data); showSelectionScores([{ name: d.name, score: d.score }]); } catch (e) {}
    });
    es.addEventListener('selection', (ev) => {
      try { const d = JSON.parse(ev.data); showScoredResponse({ scored: d.selected, rationale: d.rationale || d.message }); } catch (e) {}
    });
    es.addEventListener('agent-start', (ev) => { try { const d = JSON.parse(ev.data); setResult((prev) => prev + `\n\n[${d.name}] started...`); } catch (e) {} });
    es.addEventListener('agent-done', (ev) => { try { const d = JSON.parse(ev.data); setResult((prev) => (prev || '') + `\n\n[${d.name}] ${d.output || ''}`); } catch (e) {} });
    es.addEventListener('agent-error', (ev) => { try { const d = JSON.parse(ev.data); setResult((prev) => (prev || '') + `\n\n[${d.name} error] ${d.error || ''}`); } catch (e) {} });
    es.addEventListener('final', (ev) => { try { const d = JSON.parse(ev.data); if (d && d.result) setResult(d.result); } catch (e) {} });
    es.addEventListener('done', () => { try { es.close(); selectionPanel.classList.remove('fade-enter','fade-enter-active'); } catch (e) {} });
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
