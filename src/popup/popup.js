document.addEventListener("DOMContentLoaded", async () => {
  const summary = document.getElementById("summary");
  const resultsTable = document.getElementById("resultsTable");
  const resultsBody = document.getElementById("resultsBody");
  const noYaml = document.getElementById("noYaml");
  const copyBtn = document.getElementById("copyReport");
  const statusBadge = document.getElementById("statusBadge");
  const bootStatus = document.getElementById('bootStatus');
  const suggestionModal = document.getElementById('suggestionModal');
  const suggestionPre = document.getElementById('suggestionPre');
  const suggestionHint = document.getElementById('suggestionHint');
  const copyPatchBtn = document.getElementById('copyPatchBtn');
  const downloadPatchBtn = document.getElementById('downloadPatchBtn');
  const closeSuggestionBtn = document.getElementById('closeSuggestionBtn');
  const explainModal = document.getElementById('explainModal');
  const explainTitle = document.getElementById('explainTitle');
  const explainRationale = document.getElementById('explainRationale');
  const explainRefs = document.getElementById('explainRefs');
  const closeExplainBtn = document.getElementById('closeExplainBtn');

  // Inline SVG icons used in buttons (small, stroke=currentColor so they inherit button color)
  const ICONS = {
  // spanner-style icon (uses stroke=currentColor so it inherits button color)
  wrench: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M21.7 6.3a1 1 0 0 0-1.4 0l-2 2a6 6 0 0 1-8.48 8.48l-1.12 1.12a2.5 2.5 0 0 0 0 3.54l4 4a2.5 2.5 0 0 0 3.54 0l1.12-1.12a6 6 0 0 1 8.48-8.48l2-2a1 1 0 0 0 0-1.4l-4-4zM14.5 9.5l-1 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>',
    info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8h.01M12 11v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function parseSvg(str) {
    try {
      const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg && svg.tagName && svg.tagName.toLowerCase() === 'svg') {
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        return svg;
      }
    } catch (e) {
      // fallthrough
    }
    const sp = document.createElement('span'); sp.textContent = '';
    return sp;
  }

  // Suggestion & explain modal wiring (attach early so manual-paste flow can use them)
  if (closeSuggestionBtn) closeSuggestionBtn.addEventListener('click', () => { if (suggestionModal) suggestionModal.style.display = 'none'; });
  if (copyPatchBtn) copyPatchBtn.addEventListener('click', async () => {
    try {
      const text = suggestionPre.textContent || '';
      await navigator.clipboard.writeText(text);
      try { showToast && showToast('Patched YAML copied'); } catch (_) {}
    } catch (e) { try { showToast && showToast('Copy failed', { background: '#b91c1c' }); } catch (_) {} }
  });
  if (downloadPatchBtn) downloadPatchBtn.addEventListener('click', () => {
    try {
      const text = suggestionPre.textContent || '';
      const blob = new Blob([text], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'patched.yaml'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      try { showToast && showToast('Downloaded patched YAML'); } catch (_) {}
    } catch (e) { try { showToast && showToast('Download failed', { background: '#b91c1c' }); } catch (_) {} }
  });
  if (closeExplainBtn) closeExplainBtn.addEventListener('click', () => { if (explainModal) explainModal.style.display = 'none'; });

  // Dynamically import the rules engine so we can show an error in the UI
  // if it fails to load (instead of a silent module load error).
  let validateYaml = null;
  try {
    const m = await import('../utils/rulesEngine.js');
    validateYaml = m.validateYaml;
    // preview helper for suggestions
    var previewPatchedYaml = m.previewPatchedYaml;
    if (bootStatus) bootStatus.textContent = 'Ready';
  } catch (err) {
    console.error('Failed to load rules engine in popup:', err);
    if (bootStatus) bootStatus.textContent = 'Error loading validation engine — see console for details.';
    // Keep running so manual paste may still work; but mark validation unavailable.
  }
  let validateAvailable = typeof validateYaml === 'function';
  let previewAvailable = typeof previewPatchedYaml === 'function';

  // Load custom rules early so renderResults (used by manual flow) can
  // reference `rules` without causing a TDZ/ReferenceError.
  const { customRules } = await chrome.storage.local.get('customRules');
  const rules = customRules || [];

  // Shared results for manual validation and actions
  let results = [];

  function showValidationUnavailable(note) {
    if (bootStatus) bootStatus.textContent = note || 'Validation engine not available.';
    const summaryEl = document.getElementById('summary');
    if (summaryEl) summaryEl.textContent = 'Validation unavailable — see console for details.';
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
      statusBadge.textContent = 'ERROR';
      statusBadge.className = 'status error';
      statusBadge.style.display = 'inline-block';
    }
  }

  // Theme toggle: read persisted preference and wire the toggle
  const themeToggle = document.getElementById('themeToggle');
  async function loadTheme() {
    try {
      const { popupTheme } = await chrome.storage.local.get('popupTheme');
      const theme = popupTheme || 'light';
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body && document.body.classList.add('dark');
      }
      if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    } catch (e) {
      // fallback: do nothing
    }
  }
  loadTheme();

  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const isDark = document.documentElement.classList.toggle('dark');
      if (document.body) document.body.classList.toggle('dark', isDark);
      try {
        await chrome.storage.local.set({ popupTheme: isDark ? 'dark' : 'light' });
      } catch (e) {
        // ignore
      }
      themeToggle.textContent = isDark ? '☀️' : '🌙';
    });
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Try to get YAML text/selection by messaging the content script first (safer, doesn't require scripting permission)
  let yamlText = null;
  let fetchedFromGithub = false;
  let fetchedUrl = null;
  try {
    yamlText = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "GET_YAML" }, (resp) => {
        if (chrome.runtime.lastError) return resolve(null);
        // content script returns { yamlText: string } or a plain string
        if (!resp) return resolve(null);
        if (typeof resp === 'string') return resolve(resp);
        return resolve(resp.yamlText || null);
      });
    });
  } catch (err) {
    console.warn('sendMessage GET_YAML failed', err);
    yamlText = null;
  }

  // If messaging didn't return YAML, fall back to executeScript (use MAIN world for better selection access)
  // If messaging didn't return YAML, try fetching raw file from GitHub when on a blob URL
  if (!yamlText) {
    try {
      const pageUrl = new URL(tab.url);
      // Handle GitHub blob URLs -> raw.githubusercontent.com conversion
      if ((pageUrl.host === 'github.com' || pageUrl.host === 'www.github.com') && pageUrl.pathname.includes('/blob/')) {
        const parts = pageUrl.pathname.split('/').filter(Boolean); // [user, repo, 'blob', branch, ...path]
        const blobIndex = parts.indexOf('blob');
        if (blobIndex !== -1 && parts.length > blobIndex + 2) {
          const owner = parts[0];
          const repo = parts[1];
          const branch = parts[blobIndex + 1];
          const filePath = parts.slice(blobIndex + 2).join('/');
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
          try {
            // Prefer background service-worker fetch first to avoid any
            // page/frame sandboxing or CORS restrictions that can block
            // script execution when attempted from the page/popup context.
            let obtained = false;
            try {
              const bgResp = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'FETCH_RAW', url: rawUrl }, (r) => resolve(r));
              });
              if (bgResp && bgResp.ok && typeof bgResp.text === 'string') {
                const text = bgResp.text;
                if (/apiVersion:|kind:|metadata:/i.test(text)) {
                  yamlText = text;
                  fetchedFromGithub = true;
                  fetchedUrl = rawUrl;
                  obtained = true;
                }
              } else {
                if (bgResp && bgResp.error) console.debug('Background fetch error', bgResp.error);
              }
            } catch (e) {
              console.debug('Background fetch attempt failed', e);
            }

            // If background fetch didn't yield content, fall back to direct fetch
            if (!obtained) {
              try {
                const resp2 = await fetch(rawUrl);
                if (resp2 && resp2.ok) {
                  const text = await resp2.text();
                  if (/apiVersion:|kind:|metadata:/i.test(text)) {
                    yamlText = text;
                    fetchedFromGithub = true;
                    fetchedUrl = rawUrl;
                    obtained = true;
                  }
                }
              } catch (e) {
                console.debug('Direct fetch fallback failed', e);
              }
            }

            if (!obtained) {
              console.debug('Failed to obtain raw GitHub URL via background or direct fetch', rawUrl);
            }
          } catch (e) {
            console.debug('Unexpected error while attempting raw fetch', rawUrl, e);
          }
        }
      }
    } catch (e) {
      // ignore URL parsing errors
    }
  }

  // If still no yamlText, fall back to executeScript
  if (!yamlText) {
    try {
      const execRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || null;
          if (selection && /apiVersion:|kind:|metadata:/i.test(selection)) return selection;

          const selectors = [".blob-code-inner", ".js-file-line", ".highlight pre", "pre", "code", ".markdown-body pre", ".file .line", ".blob-code"];
          for (const s of selectors) {
            const found = document.querySelectorAll(s);
            if (found && found.length) {
              const text = Array.from(found).map(b => b.textContent).join("\n");
              if (/apiVersion:|kind:|metadata:/i.test(text)) return text;
            }
          }

          if (/\.ya?ml($|\?|#)|\/raw\/|\/blob\//i.test(location.href)) return document.body ? document.body.innerText : null;
          return null;
        },
        world: 'MAIN'
      });
      if (execRes && execRes[0] && typeof execRes[0].result === 'string') yamlText = execRes[0].result;
    } catch (err) {
      console.error('scripting.executeScript fallback failed', err);
      yamlText = null;
    }
  }

  if (!yamlText) {
    noYaml.style.display = "block";
    statusBadge.textContent = "NO YAML";
    statusBadge.className = "status info";
    statusBadge.style.display = "inline-block";
    statusBadge.classList.add('pulse');
    // Show manual textarea so user can paste YAML
    const manualDiv = document.getElementById('manual');
    const manualArea = document.getElementById('manualYaml');
    // show the entire manual block (label + controls)
    if (manualDiv) manualDiv.style.display = 'block';
    if (manualArea) manualArea.style.display = 'block';
    // Ensure fetched notice hidden when manual paste is shown
    const fetchedNotice = document.getElementById('fetchedNotice');
    if (fetchedNotice) fetchedNotice.style.display = 'none';

    // wire manual validate button
    const validateManualBtn = document.getElementById('validateManual');
    if (validateManualBtn) {
      validateManualBtn.onclick = async () => {
        const content = (document.getElementById('manualYaml') || { value: '' }).value;
        if (!content) return;
        // Ensure preview helpers receive the original YAML stream by setting
        // the shared `yamlText` variable. Also assign results to the outer
        // `results` variable (avoid shadowing) so copy/report/preview use it.
        yamlText = content;

        // If the validation engine wasn't available earlier, attempt to load it now.
        if (!validateAvailable) {
          try {
            const m2 = await import('../utils/rulesEngine.js');
            validateYaml = m2.validateYaml;
            previewPatchedYaml = m2.previewPatchedYaml;
            validateAvailable = typeof validateYaml === 'function';
            previewAvailable = typeof previewPatchedYaml === 'function';
            if (bootStatus) bootStatus.textContent = validateAvailable ? 'Ready' : 'Validation unavailable';
          } catch (e) {
            console.error('Re-import of validation engine failed', e);
          }
        }

        if (!validateAvailable) {
          showValidationUnavailable('Validation engine failed to load; cannot validate.');
          return;
        }

        try {
          // use rules loaded earlier (safe for manual flow)
          results = await validateYaml(content, rules);
          renderResults(results);
        } catch (err) {
          console.error('Manual validation failed', err);
          showValidationUnavailable('Validation failed — see console for details.');
        }
      };
    }
    return;
  }

  // If we fetched the YAML from GitHub, show a notice and hide manual controls
  if (fetchedFromGithub) {
    const fetchedNotice = document.getElementById('fetchedNotice');
    if (fetchedNotice) {
      fetchedNotice.textContent = `Validated file fetched from GitHub: ${fetchedUrl}`;
      fetchedNotice.style.display = 'block';
    }
  // hide the manual block entirely when we fetched the YAML
  const manualDiv = document.getElementById('manual');
  if (manualDiv) {
    manualDiv.style.display = 'none';
    const manualArea = document.getElementById('manualYaml');
    if (manualArea) manualArea.style.display = 'none';
  }
  }

  // custom rules already loaded earlier
  if (!rules.length) {
    summary.textContent = "No Guardon rules configured. Add them in Options.";
    statusBadge.textContent = "NO RULES";
    statusBadge.className = "status info";
    statusBadge.style.display = "inline-block";
    return;
  }

  if (!validateAvailable) {
    showValidationUnavailable('Validation engine failed to load; cannot validate YAML.');
    return;
  }
  results = [];
  try {
    results = await validateYaml(yamlText, rules);
    // If parser produced a parse-error result, show the sanitized YAML text
    // that was passed to the parser so users can inspect what we validated.
    if (results && results.some(r => r.ruleId === 'parse-error')) {
      console.debug('[popup] parse-error — sanitized YAML used for validation:\n', yamlText);
      // Create a details block to show the sanitized YAML (if not present)
      let dbg = document.getElementById('debugYamlDetails');
      if (!dbg) {
        dbg = document.createElement('details');
        dbg.id = 'debugYamlDetails';
        dbg.style.cssText = 'margin-top:8px;padding:8px;border:1px solid #eee;background:#fff;max-height:240px;overflow:auto;font-family:monospace;';
        const summ = document.createElement('summary');
        summ.textContent = 'Sanitized YAML used for validation (click to expand)';
        dbg.appendChild(summ);
        const pre = document.createElement('pre');
        pre.id = 'debugYamlPre';
        pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:8px 0;font-size:12px;';
        dbg.appendChild(pre);
        // add a small copy button
        const copyBtnDbg = document.createElement('button');
        copyBtnDbg.textContent = 'Copy sanitized YAML';
        copyBtnDbg.style.cssText = 'margin-top:6px;padding:6px 8px;';
        copyBtnDbg.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(document.getElementById('debugYamlPre').textContent || ''); showToast('Sanitized YAML copied'); } catch (e) { showToast('Copy failed', { background: '#b91c1c' }); }
        });
        dbg.appendChild(copyBtnDbg);
        const container = document.getElementById('summary') || document.body;
        container.parentNode.insertBefore(dbg, container.nextSibling);
      }
      const preEl = document.getElementById('debugYamlPre');
      if (preEl) preEl.textContent = yamlText || '';
    }
  } catch (err) {
    console.error('Validation engine threw an error', err);
    showValidationUnavailable('Validation failed — see console for details.');
    return;
  }

  if (results.length === 0) {
  summary.innerHTML = "✅ No violations found — your YAML meets Guardon checks!";
    statusBadge.textContent = "CLEAN";
    statusBadge.className = "status clean";
    statusBadge.style.display = "inline-block";
    // Hide manual input when we have a validated YAML (no need to prompt paste)
    const manualDiv = document.getElementById('manual');
    if (manualDiv) manualDiv.style.display = 'none';
    return;
  }

  // Count by severity
  const errorCount = results.filter(r => r.severity === "error").length;
  const warningCount = results.filter(r => r.severity === "warning").length;
  const infoCount = results.filter(r => r.severity === "info").length;

  let badgeClass = "warning";
  let badgeText = "WARNINGS";
  if (errorCount > 0) {
    badgeClass = "error";
    badgeText = "ERRORS";
  }

  statusBadge.textContent = badgeText;
  statusBadge.className = `status ${badgeClass}`;
  statusBadge.style.display = "inline-block";

  resultsTable.style.display = "table";
  copyBtn.style.display = "inline-block";

  summary.innerHTML = `
    Found <b>${results.length}</b> violation(s):
    ${errorCount ? `❌ ${errorCount} error(s)` : ""}
    ${warningCount ? ` ⚠️ ${warningCount} warning(s)` : ""}
    ${infoCount ? ` ℹ️ ${infoCount} info(s)` : ""}
  `;

  resultsBody.innerHTML = "";
  results.forEach(r => {
    const tr = document.createElement("tr");
    const icon = r.severity === 'error' ? '❌' : (r.severity === 'warning' ? '⚠️' : 'ℹ️');
    const tdSeverity = document.createElement('td');
    tdSeverity.className = r.severity;
    tdSeverity.innerHTML = `<span class="severity-icon">${icon}</span>${r.severity.toUpperCase()}`;

    const tdRule = document.createElement('td'); tdRule.textContent = r.ruleId;
    const tdMessage = document.createElement('td'); tdMessage.textContent = r.message;
  const tdActions = document.createElement('td');
  tdActions.className = 'actions-cell';

    if (r.suggestion) {
  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'action-btn icon-btn preview';
  previewBtn.title = 'Preview patch';
  previewBtn.setAttribute('aria-label', 'Preview patch');
  previewBtn.textContent = '🔧';
      previewBtn.addEventListener('click', async () => {
        if (!previewAvailable) {
          alert('Patch preview not available');
          return;
        }
        try {
          const patched = await previewPatchedYaml(yamlText, r.docIndex, r.suggestion, { fullStream: true });
          suggestionHint.textContent = r.suggestion.hint || (r.message || 'Suggested fix');
          suggestionPre.textContent = patched || 'Failed to generate preview';
          suggestionModal.style.display = 'flex';
        } catch (e) {
          console.error('Preview generation failed', e);
          alert('Failed to generate patch preview');
        }
      });
      tdActions.appendChild(previewBtn);

  const copySnippetBtn = document.createElement('button');
  copySnippetBtn.type = 'button';
  copySnippetBtn.className = 'action-btn icon-btn copy';
  copySnippetBtn.title = 'Copy snippet';
  copySnippetBtn.setAttribute('aria-label', 'Copy snippet');
  copySnippetBtn.textContent = '📋';
      copySnippetBtn.addEventListener('click', async () => {
        try {
          const j = globalThis.jsyaml;
          let snippetYaml = '';
          if (r.suggestion.snippetYaml) snippetYaml = r.suggestion.snippetYaml;
          else if (r.suggestion.snippetObj && j) snippetYaml = j.dump(r.suggestion.snippetObj, { noRefs: true });
          else snippetYaml = String(r.suggestion.snippetObj || r.suggestion.hint || '');
          await navigator.clipboard.writeText(snippetYaml);
          showToast('Snippet copied to clipboard');
        } catch (e) { showToast('Failed to copy snippet', { background: '#b91c1c' }); }
      });
      tdActions.appendChild(copySnippetBtn);
    }

    // Try to find the original rule metadata so we can show an explanation modal
    try {
      const matched = (rules || []).find(rr => String(rr.id) === String(r.ruleId));
      if (matched && matched.explain && (matched.explain.rationale || (Array.isArray(matched.explain.refs) && matched.explain.refs.length))) {
  const explainBtn = document.createElement('button');
  explainBtn.type = 'button';
  explainBtn.className = 'action-btn icon-btn explain';
  explainBtn.title = 'Explain policy (rationale & references)';
  explainBtn.setAttribute('aria-label', 'Explain policy');
  explainBtn.innerHTML = 'ℹ️';
        explainBtn.addEventListener('click', () => {
          explainTitle.textContent = matched.description ? `${matched.id} — ${matched.description}` : matched.id;
          explainRationale.textContent = matched.explain.rationale || '';
          // render refs as clickable links
          explainRefs.innerHTML = '';
          if (Array.isArray(matched.explain.refs) && matched.explain.refs.length) {
            const ul = document.createElement('ul');
            matched.explain.refs.forEach(u => {
              try {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = u;
                a.textContent = u;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                li.appendChild(a);
                ul.appendChild(li);
              } catch (e) {}
            });
            explainRefs.appendChild(ul);
          }
          if (explainModal) explainModal.style.display = 'flex';
        });
        tdActions.appendChild(explainBtn);
      }
    } catch (e) { console.debug('Explain button wiring failed', e && e.message); }

    tr.appendChild(tdSeverity);
    tr.appendChild(tdRule);
    tr.appendChild(tdMessage);
    tr.appendChild(tdActions);
    resultsBody.appendChild(tr);
  });

  // Copy Report Button
  copyBtn.onclick = async () => {
    const report = {
      timestamp: new Date().toISOString(),
      total: results.length,
      errors: errorCount,
      warnings: warningCount,
      infos: infoCount,
      results,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copyBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyBtn.textContent = "📋 Copy Report"), 1500);
  };
  // Suggestion/explain modal handlers wired earlier
  
  // renderResults helper used by manual validation
  function renderResults(results) {
    if (!results || results.length === 0) {
    summary.innerHTML = "✅ No violations found — your YAML meets Guardon checks!";
      statusBadge.textContent = "CLEAN";
      statusBadge.className = "status clean";
      statusBadge.style.display = "inline-block";
      resultsTable.style.display = "none";
      copyBtn.style.display = "none";
      return;
    }
    const errorCount = results.filter(r => r.severity === "error").length;
    const warningCount = results.filter(r => r.severity === "warning").length;
    const infoCount = results.filter(r => r.severity === "info").length;
    let badgeClass = "warning";
    let badgeText = "WARNINGS";
    if (errorCount > 0) { badgeClass = "error"; badgeText = "ERRORS"; }
    statusBadge.textContent = badgeText;
    statusBadge.className = `status ${badgeClass}`;
    statusBadge.style.display = "inline-block";
    resultsTable.style.display = "table";
    copyBtn.style.display = "inline-block";
    summary.innerHTML = `Found <b>${results.length}</b> violation(s): ${errorCount ? `❌ ${errorCount} error(s)` : ""} ${warningCount ? ` ⚠️ ${warningCount} warning(s)` : ""} ${infoCount ? ` ℹ️ ${infoCount} info(s)` : ""}`;
    resultsBody.innerHTML = "";
    results.forEach(r => {
        const tr = document.createElement("tr");
        const icon = r.severity === 'error' ? '❌' : (r.severity === 'warning' ? '⚠️' : 'ℹ️');
        const tdSeverity = document.createElement('td');
        tdSeverity.className = r.severity;
        tdSeverity.innerHTML = `<span class="severity-icon">${icon}</span>${r.severity.toUpperCase()}`;

        const tdRule = document.createElement('td'); tdRule.textContent = r.ruleId;
        const tdMessage = document.createElement('td'); tdMessage.textContent = r.message;
        const tdActions = document.createElement('td');

        if (r.suggestion) {
          const previewBtn = document.createElement('button');
          previewBtn.type = 'button';
          previewBtn.className = 'action-btn icon-btn preview';
          previewBtn.title = 'Preview patched YAML';
          previewBtn.setAttribute('aria-label', 'Preview patched YAML');
          previewBtn.textContent = '🔧';
          previewBtn.addEventListener('click', async () => {
            if (!previewAvailable) {
              alert('Patch preview not available');
              return;
            }
            try {
              const patched = await previewPatchedYaml(yamlText, r.docIndex, r.suggestion, { fullStream: true });
              suggestionHint.textContent = r.suggestion.hint || (r.message || 'Suggested fix');
              suggestionPre.textContent = patched || 'Failed to generate preview';
              suggestionModal.style.display = 'flex';
            } catch (e) {
              console.error('Preview generation failed', e);
              alert('Failed to generate patch preview');
            }
          });
          tdActions.appendChild(previewBtn);

          const copySnippetBtn = document.createElement('button');
          copySnippetBtn.type = 'button';
          copySnippetBtn.className = 'action-btn icon-btn copy';
          copySnippetBtn.title = 'Copy snippet';
          copySnippetBtn.setAttribute('aria-label', 'Copy snippet');
          copySnippetBtn.textContent = '📋';
          copySnippetBtn.addEventListener('click', async () => {
            try {
              const j = globalThis.jsyaml;
              let snippetYaml = '';
              if (r.suggestion.snippetYaml) snippetYaml = r.suggestion.snippetYaml;
              else if (r.suggestion.snippetObj && j) snippetYaml = j.dump(r.suggestion.snippetObj, { noRefs: true });
              else snippetYaml = String(r.suggestion.snippetObj || r.suggestion.hint || '');
              await navigator.clipboard.writeText(snippetYaml);
              showToast('Snippet copied to clipboard');
            } catch (e) { showToast('Failed to copy snippet', { background: '#b91c1c' }); }
          });
          tdActions.appendChild(copySnippetBtn);
        }

        // Explain button (if rule metadata includes explain)
        try {
          const matched = (rules || []).find(rr => String(rr.id) === String(r.ruleId));
          if (matched && matched.explain && (matched.explain.rationale || (Array.isArray(matched.explain.refs) && matched.explain.refs.length))) {
      const explainBtn = document.createElement('button');
      explainBtn.type = 'button';
      explainBtn.className = 'action-btn icon-btn explain';
      explainBtn.title = 'Explain policy (rationale & references)';
      explainBtn.setAttribute('aria-label', 'Explain policy');
      explainBtn.innerHTML = 'ℹ️';
            explainBtn.addEventListener('click', () => {
              explainTitle.textContent = matched.description ? `${matched.id} — ${matched.description}` : matched.id;
              explainRationale.textContent = matched.explain.rationale || '';
              explainRefs.innerHTML = '';
              if (Array.isArray(matched.explain.refs) && matched.explain.refs.length) {
                const ul = document.createElement('ul');
                matched.explain.refs.forEach(u => {
                  try {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = u;
                    a.textContent = u;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    li.appendChild(a);
                    ul.appendChild(li);
                  } catch (e) {}
                });
                explainRefs.appendChild(ul);
              }
              if (explainModal) explainModal.style.display = 'flex';
            });
            tdActions.appendChild(explainBtn);
          }
        } catch (e) { console.debug('Explain button wiring failed', e && e.message); }

        tr.appendChild(tdSeverity);
        tr.appendChild(tdRule);
        tr.appendChild(tdMessage);
        tr.appendChild(tdActions);
        resultsBody.appendChild(tr);
    });
  }
});
