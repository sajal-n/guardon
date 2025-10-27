// Runtime-resolving rules engine. This module avoids top-level ESM imports
// so it can be dynamically imported and run in multiple environments
// (extension content script, popup module, Node tests).

async function resolveJsYaml() {
  if (typeof globalThis !== 'undefined' && globalThis.jsyaml) return globalThis.jsyaml;

  // In extension/content-script environments prefer a UMD bundle injected
  // by the manifest (content_scripts). If it's not present, don't attempt to
  // import chrome-extension:// URLs via import() (browsers block access to
  // chrome:// or chrome-extension:// from page scripts). Instead, fall back
  // to importing the npm package (Node/dev environments).
  try {
    const mod = await import('js-yaml');
    return mod.default || mod;
  } catch (e) {
    throw new Error(
      "js-yaml runtime not found. Ensure the UMD bundle is injected (manifest content_scripts) or install the 'js-yaml' package for Node. (" +
        (e && e.message) +
        ")"
    );
  }
}

function _get(obj, path) {
  if (!path) return obj;
  const parts = path.split('.');
  let cur = obj;
  for (let part of parts) {
    const m = part.match(/([a-zA-Z0-9_\-]+)(?:\[(\d+)\])?/);
    if (!m) return undefined;
    const key = m[1];
    const idx = m[2] !== undefined ? parseInt(m[2], 10) : null;
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return undefined;
    cur = cur[key];
    if (idx !== null) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[idx];
    }
  }
  return cur;
}

function _has(obj, path) {
  return _get(obj, path) !== undefined;
}

export async function validateYaml(yamlText, rules) {
  const jsyaml = await resolveJsYaml();
  // Defensive: ensure yamlText is a string. js-yaml calls `input.split(...)`
  // internally and will throw if passed `undefined`.
  if (yamlText == null) yamlText = '';
  if (typeof yamlText !== 'string') yamlText = String(yamlText);

  let docs = [];
  try {
    // Parse all documents in the YAML stream. loadAll pushes each document
    // into the provided array via a callback.
    jsyaml.loadAll(yamlText, (d) => docs.push(d));
  } catch (err) {
    // Include mark (line/column) when available so callers can highlight the error
    const parseErr = {
      ruleId: 'parse-error',
      severity: 'error',
      message: 'Invalid YAML: ' + (err && err.message ? err.message : String(err)),
    };
    if (err && err.mark && (typeof err.mark.line === 'number' || typeof err.mark.column === 'number')) {
      parseErr.mark = { line: err.mark.line, column: err.mark.column };
    }
    return [parseErr];
  }

  if (!docs || docs.length === 0) return [];

  const results = [];

  // Validate each document separately so multi-doc YAML is supported.
  for (let docIndex = 0; docIndex < docs.length; docIndex++) {
    const doc = docs[docIndex];
    for (const rule of rules) {
      const matchPath = (rule.match || '').replace(/\[\*\]/g, '');
      const value = _get(doc, matchPath);

      // Pattern-based validation
      if (rule.pattern && typeof value === 'string' && new RegExp(rule.pattern).test(value)) {
        const res = {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message || rule.description,
          path: rule.match,
          docIndex,
        };

        // Try to infer a more specific path when rule.match is empty or generic.
        if (!res.path) {
          try {
            const inferred = findPathByValue(doc, value);
            if (inferred) res.path = inferred;
          } catch (e) {
            // silent fallback
          }
        }

        if (!res.path) console.debug(`[rulesEngine] result for rule ${rule.id} has no path`);
        results.push(res);
      }

      // Required field validation
      if (rule.required && !_has(doc, matchPath)) {
        const res = {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message || `Missing required field: ${rule.match}`,
          path: rule.match,
          docIndex,
        };
        results.push(res);
      }
    }
  }

  return results;
}

// Attempt to find a path string (dot/array notation) in `obj` whose leaf
// value equals or contains `target`. Returns the first matching path or null.
function findPathByValue(obj, target) {
  if (target == null) return null;
  const visited = new WeakSet();

  function helper(cur, path) {
    if (cur && typeof cur === 'object') {
      if (visited.has(cur)) return null;
      visited.add(cur);
      if (Array.isArray(cur)) {
        for (let i = 0; i < cur.length; i++) {
          const p = helper(cur[i], `${path}[${i}]`);
          if (p) return p;
        }
      } else {
        for (const k of Object.keys(cur)) {
          const p = helper(cur[k], path ? `${path}.${k}` : k);
          if (p) return p;
        }
      }
      return null;
    }

    // Leaf node: compare
    try {
      if (typeof target === 'string' && typeof cur === 'string') {
        if (cur.includes(target) || cur === target) return path;
      } else {
        // loose equality check for numbers/booleans
        if (cur === target) return path;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  return helper(obj, '') || null;
}
