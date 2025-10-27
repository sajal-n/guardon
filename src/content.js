// Note: load the rules engine dynamically so this script can run as a
// classic content script. Static top-level `import` causes
// "Cannot use import statement outside a module" when the script isn't
// executed as an ES module in the page.

// Utility: map field path to line number (approximate)
function findLineForPath(yamlLines, field) {
  if (!field) return -1;
  const key = String(field).split('.').pop().replace(/\[\*\]/g, '');
  const regex = new RegExp(`^\\s*${key}:`);
  for (let i = 0; i < yamlLines.length; i++) {
    if (regex.test(yamlLines[i])) return i;
  }
  return -1;
}

// helper to detect YAML/selection/text on the page
function getPageYamlText() {
  const selectors = [
    ".blob-code-inner",
    ".js-file-line",
    ".highlight pre",
    "pre",
    "code",
    ".markdown-body pre",
    ".file .line",
    ".blob-code"
  ];

  // If user has selected text on the page, prefer that
  const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || '';
  if (selection && /apiVersion:|kind:|metadata:/i.test(selection)) return selection;

  // Gather text from multiple selectors
  let blocks = [];
  for (const sel of selectors) {
    const found = document.querySelectorAll(sel);
    if (found && found.length) {
      blocks = Array.from(found);
      break;
    }
  }

  // If nothing matched, try to use the page body as a fallback for raw views
  let yamlText = '';
  if (blocks.length) {
    yamlText = Array.from(blocks).map(b => b.textContent).join('\n');
  } else {
    const urlHint = /\.ya?ml($|\?|#)|\/raw\/|\/blob\//i.test(location.href);
    if (urlHint) yamlText = document.body ? document.body.innerText : '';
  }

  if (!yamlText || !/apiVersion:|kind:|metadata:/i.test(yamlText)) return null;
  return yamlText;
}

(async function runInlineValidation() {
  // Dynamically import the module version of the rules engine from the extension bundle.
  let validateYaml;
  try {
    const m = await import(chrome.runtime.getURL('src/utils/rulesEngine.js'));
    validateYaml = m.validateYaml;
  } catch (err) {
    const url = chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('src/utils/rulesEngine.js') : 'src/utils/rulesEngine.js';
    console.error(`Failed to load rules engine module from ${url}:`, err && err.stack ? err.stack : err);
    return;
  }

  const yamlText = getPageYamlText();
  if (!yamlText) return;

  await processYamlText(yamlText, validateYaml);

  async function processYamlText(yamlText, validateYaml) {
    const { customRules } = await chrome.storage.local.get("customRules");
    const rules = customRules || [];
    if (rules.length === 0) return;

    const results = await validateYaml(yamlText, rules);
    if (results.length === 0) return;

    const yamlLines = yamlText.split('\n');

    // Add top banner
    const banner = document.createElement("div");
    banner.style.cssText = `
      background:#fff3cd;
      border:1px solid #ffeeba;
      padding:10px;
      margin-bottom:10px;
      font-family:Arial;
      color: black;
    `;
    banner.innerHTML = `<strong>⚠️ ${results.length} Guardrail Violation(s):</strong><br>` +
      results.map(r => `${r.severity.toUpperCase()}: ${r.message}`).join("<br>");
    const container = document.querySelector(".repository-content, .file");
    if (container) container.prepend(banner);

    // Recompute blocks for highlighting
    const selectors = [
      ".blob-code-inner",
      ".js-file-line",
      ".highlight pre",
      "pre",
      "code",
      ".markdown-body pre",
      ".file .line",
      ".blob-code"
    ];
    let blocks = [];
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      if (found && found.length) {
        blocks = Array.from(found);
        break;
      }
    }

    // Highlight violating lines (same strategy as before). Special-case parse errors
    results.forEach(r => {
      // If js-yaml provided a mark (line/column), prefer that for parse errors
      let lineNum = -1;
      if (r.ruleId === 'parse-error' && r.mark && typeof r.mark.line === 'number') {
        lineNum = r.mark.line; // js-yaml mark.line is zero-based
      } else {
        lineNum = findLineForPath(yamlLines, r.path);
      }

      let target = null;

      if (lineNum !== -1 && blocks[lineNum]) {
        target = blocks[lineNum];
      } else if (lineNum !== -1) {
        const lineText = (yamlLines[lineNum] || '').trim();
        for (const b of blocks) {
          if (!b || !b.textContent) continue;
          if (b.textContent.includes(lineText) || b.textContent.includes(lineText.replace(/\s+/g, ' '))) {
            target = b;
            break;
          }
        }
      }

      if (!target) {
        target = blocks[0];
        if (!target) return;
      }

      target.style.backgroundColor =
        r.severity === "error" ? "rgba(255,0,0,0.15)" :
        r.severity === "warning" ? "rgba(255,215,0,0.2)" :
        "rgba(0,123,255,0.15)";

      // Build display message; include line/column for parse errors when available
      let displayMessage = r.message;
      if (r.ruleId === 'parse-error' && r.mark && typeof r.mark.line === 'number') {
        const col = (typeof r.mark.column === 'number') ? r.mark.column + 1 : null;
        displayMessage = `${r.message} (line ${r.mark.line + 1}${col ? ', col ' + col : ''})`;
      }

      const prevTitle = target.getAttribute('title') || '';
      const newTitle = `${r.severity.toUpperCase()}: ${displayMessage}`;
      target.setAttribute('title', prevTitle ? prevTitle + '\n' + newTitle : newTitle);
    });
  }

})();

// Respond to popup messages asking for selection or YAML text
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (!msg || !msg.type) return;
    if (msg.type === 'GET_YAML') {
      const yamlText = getPageYamlText();
      sendResponse({ yamlText });
      return true;
    }
    if (msg.type === 'GET_SELECTION') {
      const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || '';
      sendResponse({ selection });
      return true;
    }
  } catch (err) {
    // ignore and return null
    sendResponse(null);
    return true;
  }
});
