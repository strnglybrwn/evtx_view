// Lightweight client script that enables paste/drop image attachments,
// shows agent suitability preview, and then opens an SSE stream for live results.
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input');
  const form = document.getElementById('form');
  const result = document.getElementById('result');
  const pastePreview = document.getElementById('pastePreview');
  const selectionPanel = document.getElementById('selectionPanel');
  const removeAllBtn = document.getElementById('removeAllBtn');
  const attachIndicator = document.getElementById('attachIndicator');

  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // ~3MB each to stay under server limit
  const MAX_B64_LENGTH = Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3);
  const attachments = [];

  function setResultText(text){
    if (!result) return;
    try{
      if (typeof text === 'function') result.textContent = text(result.textContent || '');
      else result.textContent = text || '';
      // Ensure result div is always visible
      result.style.display = 'block';
      result.style.opacity = '1';
      result.style.visibility = 'visible';
      result.style.backgroundColor = '#0a1a2e';
      result.style.color = '#ffffff';
      result.style.fontSize = '14px';
      result.style.minHeight = '140px';
      console.log('DOM updated. result.textContent:', result.textContent);
      console.log('DOM check - display:', result.style.display, 'opacity:', result.style.opacity, 'visibility:', result.style.visibility);
    }catch(e){ console.warn(e); }
  }

  function showScoredResponse(body){
    if (!selectionPanel) return;
    selectionPanel.innerHTML = '';
    const title = document.createElement('div'); title.style.marginBottom='8px'; title.style.color='var(--muted)';
    title.textContent = body.rationale || body.message || 'Agent suitability';
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
      const wrapper = document.createElement('div'); wrapper.style.position='relative'; wrapper.style.display='inline-block'; wrapper.style.marginRight='8px';
      const img = document.createElement('img'); img.style.maxWidth='120px'; img.style.maxHeight='90px'; img.style.borderRadius='6px'; img.src = `data:${att.type};base64,${att.data}`;
      const btn = document.createElement('button'); btn.textContent='✕'; btn.setAttribute('aria-label','Remove');
      btn.style.position='absolute'; btn.style.top='-6px'; btn.style.right='-6px'; btn.style.padding='3px 6px'; btn.style.borderRadius='6px'; btn.style.border='none'; btn.style.cursor='pointer';
      btn.onclick = () => { attachments.splice(idx,1); renderPastePreview(); };
      wrapper.appendChild(img); wrapper.appendChild(btn); pastePreview.appendChild(wrapper);
    });
    if (removeAllBtn) removeAllBtn.style.display = attachments.length ? 'inline-block' : 'none';
    if (attachIndicator) attachIndicator.style.display = attachments.length ? 'inline' : 'none';
  }

  function handleImageFile(file){
    return new Promise((res, rej) => {
      if (attachments.length >= MAX_ATTACHMENTS) {
        alert(`Too many attachments. Limit ${MAX_ATTACHMENTS}.`);
        return res();
      }
      try{
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result || '';
          const parts = dataUrl.split(',');
          const b64 = parts[1] || '';
          if (b64.length > MAX_B64_LENGTH) {
            alert(`Attachment "${file.name || 'image'}" is too large (max ~3MB).`);
            return res();
          }
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

  if (input){
    input.addEventListener('paste', async (ev) => {
      try{
        const items = ev.clipboardData && ev.clipboardData.items;
        if (items){
          for (let i=0;i<items.length;i++){
            const it = items[i]; if (!it) continue;
            if (it.kind === 'file'){ const f = it.getAsFile(); if (f && f.type && f.type.startsWith('image')) await handleImageFile(f); }
            else if (it.type && it.type.startsWith('image')){ const blob = it.getAsFile(); if (blob) await handleImageFile(blob); }
          }
        } else if (ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length){
          for (let f of ev.clipboardData.files) if (f.type && f.type.startsWith('image')) await handleImageFile(f);
        }
      }catch(err){ console.warn('paste handling failed', err); }
    });

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

  if (form) form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    setResultText('Analyzing suitability...');
    try{
      const previewPayload = { input: input.value, preview: true };
      if (attachments.length) previewPayload.attachments = attachments;
      const previewResp = await fetch('/api/solve',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(previewPayload)});
      const previewBody = await previewResp.json();
      if (!previewResp.ok) throw new Error(previewBody.error || JSON.stringify(previewBody));
      showScoredResponse(previewBody);

      // If there are attachments but no textual input, do a regular POST to run agents
      // (EventSource GET cannot include a request body with attachments)
      const isEmptyInput = !input.value || input.value.trim() === '';
      if (attachments.length && isEmptyInput) {
        setResultText('Running agents with attachments...');
        try {
          const runPayload = { input: input.value || '', preview: false, attachments };
          const runResp = await fetch('/api/solve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(runPayload) });
          const runBody = await runResp.json();
          if (!runResp.ok) throw new Error(runBody.error || JSON.stringify(runBody));
          // show final result
          if (runBody.result) setResultText(runBody.result);
          if (runBody.scored) showScoredResponse(runBody);
        } catch (err) {
          setResultText('Error: '+String(err));
        }
        return;
      }

      // If there are attachments alongside text, run via POST so attachments are included
      if (attachments.length) {
        setResultText('Running agents with attachments...');
        try {
          const runPayload = { input: input.value || '', preview: false, attachments };
          const runResp = await fetch('/api/solve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(runPayload) });
          const runBody = await runResp.json();
          if (!runResp.ok) throw new Error(runBody.error || JSON.stringify(runBody));
          if (runBody.result) setResultText(runBody.result);
          if (runBody.scored) showScoredResponse(runBody);
        } catch (err) {
          setResultText('Error: '+String(err));
        }
        return;
      }

      setResultText('Opening live stream for selected agent...');
      const esUrl = `/api/solve-stream?input=${encodeURIComponent(input.value)}`;
      const es = new EventSource(esUrl);
      es.addEventListener('selection',(ev)=>{
        try{
          const d=JSON.parse(ev.data);
          showScoredResponse({ selected: d.selected || [], rationale: d.rationale || d.message });
        }catch(e){ console.error('selection parse', e); }
      });
      es.addEventListener('agent-start',(ev)=>{
        try{ const d=JSON.parse(ev.data); setResultText(prev=> (prev?prev+'\n\n':'')+`[${d.name}] started...`); }catch(e){ console.error('agent-start parse', e); }
      });
      es.addEventListener('agent-done',(ev)=>{
        try{ const d=JSON.parse(ev.data); setResultText(prev=> (prev?prev+'\n\n':'')+`[${d.name}] ${d.output||''}`); }catch(e){ console.error('agent-done parse', e); }
      });
      es.addEventListener('agent-error',(ev)=>{
        try{ const d=JSON.parse(ev.data); setResultText(prev=> (prev?prev+'\n\n':'')+`[${d.name} error] ${d.error||''}`); }catch(e){ console.error('agent-error parse', e); }
      });
      es.addEventListener('final',(ev)=>{
        try{ const d=JSON.parse(ev.data); if (d && d.result) setResultText(d.result); }catch(e){ console.error('final parse', e); }
      });
      es.addEventListener('done',()=>{ try{ es.close(); }catch(e){ console.error('done close', e); } });

    }catch(err){ setResultText('Error: '+String(err)); }
  });

  // initial
  renderPastePreview();
});
