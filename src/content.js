// Content script no longer performs inline validation or injects banners on page load.
// Validation is performed explicitly by the extension popup which messages this
// content script to request YAML text or the user's selection. This keeps the
// page DOM untouched unless the user explicitly validates using the extension.

// helper to detect YAML/selection/text on the page (sanitizes common injected elements)
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
    yamlText = Array.from(blocks).map(b => {
      if (!b) return '';
      try {
        const clone = b.cloneNode(true);
  const banner = clone.querySelector('#guardon-banner');
  if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
        return clone.textContent || '';
      } catch (e) {
        return b.textContent || '';
      }
    }).join('\n');
  } else {
    const urlHint = /\.ya?ml($|\?|#)|\/raw\/|\/blob\//i.test(location.href);
    if (urlHint) yamlText = document.body ? document.body.innerText : '';
  }

  // If using body fallback, remove common injected elements before reading text
  if (yamlText && (!blocks.length) && document.body) {
    try {
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.querySelectorAll('script, template, noscript');
      scripts.forEach(s => s.parentNode && s.parentNode.removeChild(s));
      const jsonEls = bodyClone.querySelectorAll('[type="application/json"], [type="application/ld+json"]');
      jsonEls.forEach(e => e.parentNode && e.parentNode.removeChild(e));
      const uiEls = bodyClone.querySelectorAll('.js-repo-meta-container, #repository-container-header, .site-footer');
      uiEls.forEach(e => e.parentNode && e.parentNode.removeChild(e));
      yamlText = bodyClone.innerText || '';
    } catch (e) {
      // ignore and keep original yamlText
    }
  }

  if (!yamlText || !/apiVersion:|kind:|metadata:/i.test(yamlText)) return null;
  return yamlText;
}

// Message handler: respond to GET_YAML and GET_SELECTION only. Do not modify the page.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'GET_YAML') {
    try {
      const yaml = getPageYamlText();
      sendResponse({ yamlText: yaml });
    } catch (e) {
      sendResponse({ yamlText: null });
    }
    return true; // indicate async (though we call sendResponse synchronously)
  }
  if (msg.type === 'GET_SELECTION') {
    try {
      const sel = (window.getSelection && window.getSelection().toString && window.getSelection().toString()) || '';
      sendResponse({ selection: sel });
    } catch (e) {
      sendResponse({ selection: '' });
    }
    return true;
  }
});
