let rules = [];
let editingIndex = null;

const tableBody = document.getElementById("rulesBody");
const form = document.getElementById("form");
const formTitle = document.getElementById("formTitle");

const inputs = {
  id: document.getElementById("ruleId"),
  desc: document.getElementById("ruleDesc"),
  kind: document.getElementById("ruleKind"),
  match: document.getElementById("ruleMatch"),
  pattern: document.getElementById("rulePattern"),
  required: document.getElementById("ruleRequired"),
  severity: document.getElementById("ruleSeverity"),
  message: document.getElementById("ruleMessage"),
  enabled: document.getElementById("ruleEnabled"),
  fix: document.getElementById("ruleFix"),
  rationale: document.getElementById("ruleRationale"),
  references: document.getElementById("ruleReferences"),
};

// Import-from-URL elements (added feature)
const importUrlInput = document.getElementById('importUrl');
const fetchUrlBtn = document.getElementById('fetchUrl');

// Load rules
chrome.storage.local.get("customRules", (data) => {
  rules = data.customRules || [];
  renderTable();
});

// Toast helper
function showToast(msg, opts = {}) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = opts.background || '#111';
  toast.style.display = 'block';
  toast.style.opacity = '1';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.style.transition = 'opacity 300ms ease';
    toast.style.opacity = '0';
    setTimeout(() => (toast.style.display = 'none'), 300);
  }, opts.duration || 2500);
}

function renderTable() {
  tableBody.innerHTML = "";
  rules.forEach((r, idx) => {
    const tr = document.createElement("tr");
    const tdId = document.createElement('td'); tdId.textContent = r.id || '';
    const tdEnabled = document.createElement('td');
    const enChk = document.createElement('input');
    enChk.type = 'checkbox';
    enChk.checked = (r.enabled === undefined) ? true : !!r.enabled;
    enChk.addEventListener('change', () => {
      rules[idx].enabled = !!enChk.checked;
      saveRules();
      // mild visual feedback
      tr.style.opacity = enChk.checked ? '1' : '0.5';
    });
    tdEnabled.appendChild(enChk);
    tdEnabled.style.textAlign = 'center';
  const tdDesc = document.createElement('td'); tdDesc.textContent = r.description || '';
  const tdKind = document.createElement('td'); tdKind.textContent = r.kind || '';
  const tdSeverity = document.createElement('td'); tdSeverity.textContent = r.severity || '';
    const tdActions = document.createElement('td');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '✏️ Edit';
    editBtn.addEventListener('click', () => editRule(idx));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '🗑 Delete';
    delBtn.addEventListener('click', () => deleteRule(idx));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdId);
    tr.appendChild(tdEnabled);
    // Visual hint for disabled rules
    tr.style.opacity = (r.enabled === undefined || r.enabled) ? '1' : '0.5';
    tr.appendChild(tdDesc);
    tr.appendChild(tdKind);
    tr.appendChild(tdSeverity);
    tr.appendChild(tdActions);
    tableBody.appendChild(tr);
  });
}

window.editRule = function (idx) {
  editingIndex = idx;
  const r = rules[idx];
  form.style.display = "block";
  formTitle.textContent = "Edit Rule";
  inputs.id.value = r.id;
  inputs.desc.value = r.description;
  inputs.kind.value = r.kind || '';
  inputs.match.value = r.match;
  inputs.pattern.value = r.pattern || "";
  // r.required may be boolean; convert to string 'true'/'false' for the select
  inputs.required.value = (r.required === true || r.required === 'true') ? 'true' : 'false';
  inputs.severity.value = r.severity;
  inputs.message.value = r.message;
  // enabled may be undefined (legacy) -> treat as true
  if (inputs.enabled) inputs.enabled.checked = (r.enabled === undefined) ? true : !!r.enabled;
  if (inputs.fix) {
    try {
      inputs.fix.value = r.fix ? JSON.stringify(r.fix, null, 2) : '';
    } catch (e) { inputs.fix.value = '' }
  }
  if (inputs.rationale) inputs.rationale.value = r.explain && r.explain.rationale ? r.explain.rationale : '';
  if (inputs.references) inputs.references.value = r.explain && Array.isArray(r.explain.refs) ? r.explain.refs.join(',') : (r.references || '');
};

window.deleteRule = function (idx) {
  if (confirm("Delete this rule?")) {
    rules.splice(idx, 1);
    saveRules();
    renderTable();
  }
};

document.getElementById("addRule").onclick = () => {
  editingIndex = null;
  formTitle.textContent = "Add Rule";
  Object.values(inputs).forEach(i => i.value = "");
  inputs.required.value = "false";
  inputs.severity.value = "warning";
  form.style.display = "block";
};

document.getElementById("cancelRule").onclick = () => {
  form.style.display = "none";
};

document.getElementById("saveRule").onclick = () => {
  const newRule = {
    id: inputs.id.value.trim(),
    description: inputs.desc.value.trim(),
    kind: inputs.kind.value.trim(),
    match: inputs.match.value.trim(),
    pattern: inputs.pattern.value.trim(),
    required: inputs.required.value === "true",
    enabled: inputs.enabled ? !!inputs.enabled.checked : true,
    severity: inputs.severity.value,
    message: inputs.message.value.trim(),
    // parse fix JSON if provided; keep as object
    fix: (function(){
      if (!inputs.fix) return undefined;
      const v = (inputs.fix.value || '').trim();
      if (!v) return undefined;
      try { return JSON.parse(v); } catch (e) { showToast('Fix JSON invalid: ' + (e && e.message), { background: '#b91c1c' }); return undefined; }
    })(),
    // explain metadata: rationale + refs (array)
    explain: (function(){
      if (!inputs || !inputs.rationale) return undefined;
      const rationale = (inputs.rationale.value || '').trim();
      const refsRaw = (inputs.references && inputs.references.value) ? String(inputs.references.value || '') : '';
      const refs = refsRaw.split(',').map(s=>s.trim()).filter(Boolean);
      if (!rationale && refs.length === 0) return undefined;
      return { rationale: rationale || '', refs };
    })(),
  };

  // All fields are mandatory
  const missingFields = [];
  if (!newRule.id) missingFields.push('id');
  if (!newRule.description) missingFields.push('description');
  if (!newRule.kind) missingFields.push('kind');
  if (!newRule.match) missingFields.push('match');
  if (!newRule.pattern) missingFields.push('pattern');
  if (typeof newRule.required !== 'boolean') missingFields.push('required');
  if (!newRule.severity) missingFields.push('severity');
  if (!newRule.message) missingFields.push('message');

  if (missingFields.length) {
    showToast('Missing required fields: ' + missingFields.join(', '), { background: '#b91c1c' });
    return;
  }

  // Validate severity
  const allowedSeverities = ['info', 'warning', 'error'];
  if (!allowedSeverities.includes(newRule.severity)) {
    showToast('Severity must be one of: info, warning, error', { background: '#b91c1c' });
    return;
  }

  // Prevent duplicate IDs (unless editing the same index)
  const duplicateIdx = rules.findIndex((r, i) => r.id === newRule.id && i !== editingIndex);
  if (duplicateIdx !== -1) {
    showToast(`Rule ID "${newRule.id}" already exists. Choose a unique ID.`, { background: '#b91c1c' });
    return;
  }

  if (editingIndex !== null) rules[editingIndex] = newRule;
  else rules.push(newRule);

  saveRules();
  form.style.display = "none";
  renderTable();
  showToast(editingIndex !== null ? 'Rule updated' : 'Rule added', { background: '#059669' });
};

function saveRules() {
  chrome.storage.local.set({ customRules: rules });
}

document.getElementById("importRules").onclick = async () => {
  // Show the import panel where users can upload a JSON file or paste JSON
  const panel = document.getElementById('importPanel');
  if (panel) panel.style.display = 'block';
};

// Cancel import
document.getElementById('cancelImport').onclick = () => {
  const panel = document.getElementById('importPanel');
  if (panel) panel.style.display = 'none';
  const ta = document.getElementById('importTextarea'); if (ta) ta.value = '';
  const file = document.getElementById('importFile'); if (file) file.value = null;
};

// Paste from clipboard into the textarea
document.getElementById('pasteClipboard').onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const ta = document.getElementById('importTextarea');
    if (ta) ta.value = text || '';
    showToast('Pasted clipboard into import area', { background: '#0ea5e9' });
  } catch (e) {
    showToast('Failed to read clipboard', { background: '#b91c1c' });
  }
};

// Helper: apply an array of normalized rules (id/description/kind/match/required/...) into storage
function applyNormalizedRules(normalized) {
  if (!Array.isArray(normalized) || normalized.length === 0) {
    showToast('No convertible rules found.', { background: '#b91c1c' });
    return;
  }

  // Basic validation and normalization (ensure id exists)
  const norm = normalized.map(r => ({
    id: String(r.id || '').trim(),
    description: r.description || r.desc || '',
    kind: r.kind || '',
    match: r.match || '',
    pattern: r.pattern || '',
    required: r.required === true || r.required === 'true',
    enabled: (r.enabled === undefined) ? true : (r.enabled === true || r.enabled === 'true'),
    fix: r.fix !== undefined ? r.fix : undefined,
    explain: r.explain !== undefined ? r.explain : (r.rationale || r.references ? { rationale: r.rationale || '', refs: Array.isArray(r.references) ? r.references : (typeof r.references === 'string' ? r.references.split(',').map(s=>s.trim()).filter(Boolean) : []) } : undefined),
    severity: r.severity || 'warning',
    message: r.message || '',
  }));

  let added = 0, replaced = 0;
  for (const nr of norm) {
    if (!nr.id) continue;
    const idx = rules.findIndex(r => r.id === nr.id);
    if (idx !== -1) {
      rules[idx] = nr;
      replaced++;
    } else {
      rules.push(nr);
      added++;
    }
  }

  if (added === 0 && replaced === 0) {
    showToast('No rules imported.', { background: '#b91c1c' });
  } else {
    saveRules();
    renderTable();
    showToast(`Imported ${added} new, replaced ${replaced} existing rule(s)`, { background: '#059669' });
  }
}

// Save original Kyverno policy text into storage for auditability.
function saveRawKyverno(rawText, meta = {}) {
  try {
    const entry = {
      id: meta.id || `kyverno-${Date.now()}`,
      url: meta.url || null,
      savedAt: new Date().toISOString(),
      text: rawText,
    };
    chrome.storage.local.get('rawKyvernoPolicies', (data) => {
      const arr = Array.isArray(data.rawKyvernoPolicies) ? data.rawKyvernoPolicies : [];
      arr.push(entry);
      chrome.storage.local.set({ rawKyvernoPolicies: arr }, () => {
        showToast('Stored original Kyverno policy for audit', { background: '#0ea5e9' });
      });
    });
  } catch (e) {
    console.debug('Failed to save raw Kyverno', e && e.message);
  }
}

// Kyverno preview modal helpers
const kyvernoModal = document.getElementById('kyvernoModal');
const kyvernoPreviewBody = document.getElementById('kyvernoPreviewBody');
const kyvernoMeta = document.getElementById('kyvernoMeta');
const kyvernoImportConvertedBtn = document.getElementById('kyvernoImportConverted');
const kyvernoImportRawBtn = document.getElementById('kyvernoImportRaw');
const kyvernoCancelBtn = document.getElementById('kyvernoCancel');

let _kyvernoPreviewState = null; // { converted:[], rawText, meta }

function showKyvernoPreview(converted, rawText, meta = {}) {
  _kyvernoPreviewState = { converted, rawText, meta };
  if (!kyvernoModal) return;
  kyvernoPreviewBody.innerHTML = '';
  kyvernoMeta.textContent = `Policy source: ${meta.url || 'fetched content'} — converted ${converted.length} rule(s)`;
  // Render rows with a checkbox per converted rule so users may choose which
  // converted rules to import. Each checkbox value is the index in the
  // converted array.
  converted.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const chkTd = document.createElement('td');
    chkTd.style.padding = '6px';
    chkTd.style.borderBottom = '1px solid #eee';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'kyvernoRowCheckbox';
    chk.value = String(idx);
    // default to checked so users get all rules unless they uncheck
    chk.checked = true;
    chkTd.appendChild(chk);

    const idTd = document.createElement('td'); idTd.style.padding = '6px'; idTd.style.borderBottom = '1px solid #eee'; idTd.textContent = escapeHtml(r.id);
    const descTd = document.createElement('td'); descTd.style.padding = '6px'; descTd.style.borderBottom = '1px solid #eee'; descTd.textContent = escapeHtml(r.description);
    const kindTd = document.createElement('td'); kindTd.style.padding = '6px'; kindTd.style.borderBottom = '1px solid #eee'; kindTd.textContent = escapeHtml(r.kind);
    const matchTd = document.createElement('td'); matchTd.style.padding = '6px'; matchTd.style.borderBottom = '1px solid #eee'; matchTd.textContent = escapeHtml(r.match);
    const msgTd = document.createElement('td'); msgTd.style.padding = '6px'; msgTd.style.borderBottom = '1px solid #eee'; msgTd.textContent = escapeHtml(r.message);

    tr.appendChild(chkTd);
    tr.appendChild(idTd);
    tr.appendChild(descTd);
    tr.appendChild(kindTd);
    tr.appendChild(matchTd);
    tr.appendChild(msgTd);
    kyvernoPreviewBody.appendChild(tr);
  });

  // Wire the select-all checkbox (if present) to toggle all row checkboxes.
  const selectAll = document.getElementById('kyvernoSelectAll');
  if (selectAll) {
    // default: selectAll checked when we opened the preview
    selectAll.checked = true;
    selectAll.onclick = () => {
      const checked = !!selectAll.checked;
      const boxes = kyvernoPreviewBody.querySelectorAll('input.kyvernoRowCheckbox');
      boxes.forEach(b => b.checked = checked);
    };
  }
  kyvernoModal.style.display = 'flex';
}

function hideKyvernoPreview() {
  _kyvernoPreviewState = null;
  if (!kyvernoModal) return;
  kyvernoModal.style.display = 'none';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"'`]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"}[c]));
}

if (kyvernoCancelBtn) kyvernoCancelBtn.addEventListener('click', hideKyvernoPreview);
if (kyvernoImportRawBtn) kyvernoImportRawBtn.addEventListener('click', () => {
  if (!_kyvernoPreviewState) return;
  saveRawKyverno(_kyvernoPreviewState.rawText, _kyvernoPreviewState.meta);
  hideKyvernoPreview();
});
if (kyvernoImportConvertedBtn) kyvernoImportConvertedBtn.addEventListener('click', () => {
  if (!_kyvernoPreviewState) return;
  // Collect selected checkboxes from the preview table. Each checkbox value
  // is the index into the converted array that was rendered earlier.
  const boxes = kyvernoPreviewBody.querySelectorAll('input.kyvernoRowCheckbox');
  const selected = [];
  boxes.forEach(b => {
    try {
      if (b.checked) {
        const idx = Number(b.value);
        const item = _kyvernoPreviewState.converted[idx];
        if (item) selected.push(item);
      }
    } catch (e) {}
  });

  if (!selected.length) {
    showToast('No converted rules selected to import.', { background: '#b91c1c' });
    return;
  }

  applyNormalizedRules(selected);
  // Also store raw policy for auditability
  saveRawKyverno(_kyvernoPreviewState.rawText, _kyvernoPreviewState.meta);
  hideKyvernoPreview();
});

// Fetch JSON from a URL and populate the import textarea. Tries a direct
// fetch first; if that fails (CORS/etc.) falls back to asking the
// background service worker to fetch the URL (requires host_permissions).
if (fetchUrlBtn) {
  fetchUrlBtn.addEventListener('click', async () => {
    const url = (importUrlInput && importUrlInput.value || '').trim();
    if (!url) {
      showToast('Enter a URL to fetch', { background: '#b91c1c' });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      showToast('Invalid URL', { background: '#b91c1c' });
      return;
    }

    const ta = document.getElementById('importTextarea');
    showToast('Fetching URL...', { background: '#f59e0b', duration: 4000 });

    // Try direct fetch first
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        // Try to auto-detect Kyverno policies in YAML
        let isKyverno = false;
        try {
          const docs = [];
          if (globalThis && globalThis.jsyaml && typeof globalThis.jsyaml.loadAll === 'function') {
            globalThis.jsyaml.loadAll(text, (d) => docs.push(d));
          }
          if (Array.isArray(docs) && docs.some(d => d && d.apiVersion && String(d.apiVersion).toLowerCase().includes('kyverno.io') && (String(d.kind || '').toLowerCase() === 'policy' || String(d.kind || '').toLowerCase() === 'clusterpolicy'))) {
            isKyverno = true;
            const converted = (window.kyvernoImporter && window.kyvernoImporter.convertDocs) ? window.kyvernoImporter.convertDocs(docs) : [];
            if (converted && converted.length > 0) {
              // Show preview modal instead of simple confirm()
              showKyvernoPreview(converted, text, { url });
              return;
            }
          }
        } catch (e) {
          console.debug('Kyverno detection failed', e && e.message);
        }

        if (ta) ta.value = text;
        showToast('Fetched content into import area' + (isKyverno ? ' (Kyverno detected — conversion available)' : ''), { background: '#059669' });
        return;
      }
      // fallthrough to background fetch if not ok
      console.debug('Direct fetch returned status', resp.status, resp.statusText);
    } catch (e) {
      console.debug('Direct fetch failed (likely CORS):', e && e.message);
    }

    // Fallback: ask background service worker to fetch (requires host_permissions)
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_RAW', url }, (resp) => resolve(resp));
      });
      if (!response) throw new Error('No response from background fetch');
      if (!response.ok) {
        throw new Error(response.error || `status ${response.status} ${response.statusText || ''}`);
      }
      const fetchedText = response.text || '';
      // Try Kyverno detection on background-fetched content as well
      try {
        const docs = [];
        if (globalThis && globalThis.jsyaml && typeof globalThis.jsyaml.loadAll === 'function') {
          globalThis.jsyaml.loadAll(fetchedText, (d) => docs.push(d));
        }
        const isKyvernoBg = Array.isArray(docs) && docs.some(d => d && d.apiVersion && String(d.apiVersion).toLowerCase().includes('kyverno.io') && (String(d.kind || '').toLowerCase() === 'policy' || String(d.kind || '').toLowerCase() === 'clusterpolicy'));
        if (isKyvernoBg) {
          const converted = (window.kyvernoImporter && window.kyvernoImporter.convertDocs) ? window.kyvernoImporter.convertDocs(docs) : [];
          if (converted && converted.length > 0) {
            showKyvernoPreview(converted, fetchedText, { url });
            return;
          }
        }
      } catch (e) {
        console.debug('Kyverno detection failed for background fetch', e && e.message);
      }

      if (ta) ta.value = fetchedText;
      showToast('Fetched content via background helper', { background: '#059669' });
    } catch (e) {
      showToast('Failed to fetch URL: ' + (e && e.message ? e.message : String(e)), { background: '#b91c1c' });
    }
  });
}

// Handle file selection: read file into textarea for preview/import
document.getElementById('importFile').addEventListener('change', (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const ta = document.getElementById('importTextarea');
    if (ta) ta.value = String(reader.result || '');
  };
  reader.onerror = () => showToast('Failed to read file', { background: '#b91c1c' });
  reader.readAsText(f);
});

// Parse and import the JSON from textarea (or file-loaded content)
document.getElementById('doImport').onclick = () => {
  const ta = document.getElementById('importTextarea');
  const text = ta ? ta.value.trim() : '';
  if (!text) {
    showToast('Nothing to import. Paste JSON or choose a file.', { background: '#b91c1c' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    showToast('Invalid JSON: ' + (e && e.message ? e.message : 'parse error'), { background: '#b91c1c' });
    return;
  }

  // Accept either an array of rules or an object { customRules: [...] }
  let imported = null;
  if (Array.isArray(parsed)) imported = parsed;
  else if (parsed && Array.isArray(parsed.customRules)) imported = parsed.customRules;
  else {
    showToast('JSON must be an array of rules or an object with a `customRules` array.', { background: '#b91c1c' });
    return;
  }

  // Basic validation: ensure each rule contains all mandatory fields
  for (let i = 0; i < imported.length; i++) {
    const r = imported[i];
    if (!r || typeof r !== 'object') {
      showToast(`Imported item at index ${i} is not a valid object.`, { background: '#b91c1c' });
      return;
    }
    const missing = [];
    if (!(typeof r.id === 'string' && r.id.trim())) missing.push('id');
    if (!(typeof r.description === 'string' && r.description.trim())) missing.push('description');
    if (!(typeof r.kind === 'string' && r.kind.trim())) missing.push('kind');
    if (!(typeof r.match === 'string' && r.match.trim())) missing.push('match');
    if (!(typeof r.pattern === 'string' && r.pattern.trim())) missing.push('pattern');
    if (!((r.required === true || r.required === false) || (r.required === 'true' || r.required === 'false'))) missing.push('required');
    if (!(typeof r.severity === 'string' && ['info','warning','error'].includes(r.severity))) missing.push('severity');
    if (!(typeof r.message === 'string' && r.message.trim())) missing.push('message');

    if (missing.length) {
      const idDisplay = r.id ? ` (id: ${String(r.id)})` : '';
      showToast(`Imported rule at index ${i}${idDisplay} is missing fields: ${missing.join(', ')}`, { background: '#b91c1c' });
      return;
    }
  }

  // Add imported rules to existing rules (append). Skip any imported rule
  // whose id already exists to avoid overwriting or creating duplicates.
  const normalized = imported.map(r => ({
    id: String(r.id).trim(),
    description: r.description || r.desc || '',
    kind: r.kind || '',
    match: r.match || '',
    pattern: r.pattern || '',
    required: r.required === true || r.required === 'true',
    severity: r.severity || 'warning',
    message: r.message || '',
    fix: r.fix !== undefined ? r.fix : undefined,
  }));

  let added = 0;
  let replaced = 0;
  for (const nr of normalized) {
    const idx = rules.findIndex(r => r.id === nr.id);
    if (idx !== -1) {
      // Overwrite existing rule with same id
      rules[idx] = nr;
      replaced++;
    } else {
      rules.push(nr);
      added++;
    }
  }

  if (added === 0 && replaced === 0) {
    showToast('No rules imported.', { background: '#b91c1c' });
  } else {
    saveRules();
    renderTable();
    showToast(`Imported ${added} new, replaced ${replaced} existing rule(s)` + (replaced === 0 ? '' : ''), { background: '#059669' });
  }
  // Hide and clear panel
  const panel = document.getElementById('importPanel'); if (panel) panel.style.display = 'none';
  if (ta) ta.value = '';
  const file = document.getElementById('importFile'); if (file) file.value = null;
};

document.getElementById("exportRules").onclick = async () => {
  const payload = JSON.stringify({ customRules: rules }, null, 2);

  // 1) Trigger download
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
  a.download = 'guardon-rules.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported rules as file', { background: '#0ea5e9' });
  } catch (e) {
    showToast('Failed to create download', { background: '#b91c1c' });
  }

  // 2) Also try to copy to clipboard for convenience
  try {
    await navigator.clipboard.writeText(payload);
    showToast('Also copied JSON to clipboard', { background: '#0ea5e9' });
  } catch (e) {
    // clipboard may be unavailable in some contexts; ignore silently
  }
};
