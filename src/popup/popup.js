document.addEventListener("DOMContentLoaded", async () => {
  const summary = document.getElementById("summary");
  const resultsTable = document.getElementById("resultsTable");
  const resultsBody = document.getElementById("resultsBody");
  const noYaml = document.getElementById("noYaml");
  const copyBtn = document.getElementById("copyReport");
  const statusBadge = document.getElementById("statusBadge");
  const bootStatus = document.getElementById('bootStatus');

  // Dynamically import the rules engine so we can show an error in the UI
  // if it fails to load (instead of a silent module load error).
  let validateYaml = null;
  try {
    const m = await import('../utils/rulesEngine.js');
    validateYaml = m.validateYaml;
    if (bootStatus) bootStatus.textContent = 'Ready';
  } catch (err) {
    console.error('Failed to load rules engine in popup:', err);
    if (bootStatus) bootStatus.textContent = 'Error loading validation engine — see console for details.';
    // Keep running so manual paste may still work; but mark validation unavailable.
  }

  // Theme toggle: read persisted preference and wire the toggle
  const themeToggle = document.getElementById('themeToggle');
  async function loadTheme() {
    try {
      const { popupTheme } = await chrome.storage.local.get('popupTheme');
      const theme = popupTheme || 'light';
      if (theme === 'dark') document.documentElement.classList.add('dark');
      if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    } catch (e) {
      // fallback: do nothing
    }
  }
  loadTheme();

  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const isDark = document.documentElement.classList.toggle('dark');
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
            const resp = await fetch(rawUrl);
            if (resp.ok) {
              const text = await resp.text();
              if (/apiVersion:|kind:|metadata:/i.test(text)) {
                yamlText = text;
              }
            }
          } catch (e) {
            console.debug('Failed to fetch raw GitHub URL', rawUrl, e);
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
    const manualArea = document.getElementById('manualYaml');
    manualArea.style.display = 'block';
    // wire manual buttons below
    document.getElementById('useSelection').onclick = async () => {
      // Try messaging the content script first
      let sel = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }, (resp) => {
          if (chrome.runtime.lastError) return resolve('');
          if (!resp) return resolve('');
          if (typeof resp === 'string') return resolve(resp);
          return resolve(resp.selection || '');
        });
      });

      // Fallback to executeScript if messaging didn't work
      if (!sel) {
        try {
          const r = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || '',
            world: 'MAIN'
          });
          sel = r && r[0] && r[0].result ? r[0].result : '';
        } catch (err) {
          console.error('Use Selection executeScript failed', err);
          sel = '';
        }
      }

      if (sel) {
        manualArea.value = sel;
      } else {
        manualArea.placeholder = 'No selection detected on page.';
      }
    };
    document.getElementById('validateManual').onclick = async () => {
      const content = document.getElementById('manualYaml').value;
      if (!content) return;
      const results = await validateYaml(content, await (async () => { const { customRules } = await chrome.storage.local.get('customRules'); return customRules || []; })());
      renderResults(results);
    };
    return;
  }

  const { customRules } = await chrome.storage.local.get("customRules");
  const rules = customRules || [];

  if (!rules.length) {
    summary.textContent = "No guardrail rules configured. Add them in Options.";
    statusBadge.textContent = "NO RULES";
    statusBadge.className = "status info";
    statusBadge.style.display = "inline-block";
    return;
  }

  const results = await validateYaml(yamlText, rules);

  if (results.length === 0) {
    summary.innerHTML = "✅ No violations found — your YAML meets all guardrails!";
    statusBadge.textContent = "CLEAN";
    statusBadge.className = "status clean";
    statusBadge.style.display = "inline-block";
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
    tr.innerHTML = `
      <td class="${r.severity}"><span class="severity-icon">${icon}</span>${r.severity.toUpperCase()}</td>
      <td>${r.ruleId}</td>
      <td>${r.message}</td>
    `;
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
  
  // renderResults helper used by manual validation
  function renderResults(results) {
    if (!results || results.length === 0) {
      summary.innerHTML = "✅ No violations found — your YAML meets all guardrails!";
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
      tr.innerHTML = `
        <td class="${r.severity}"><span class="severity-icon">${icon}</span>${r.severity.toUpperCase()}</td>
        <td>${r.ruleId}</td>
        <td>${r.message}</td>
      `;
      resultsBody.appendChild(tr);
    });
  }
});
