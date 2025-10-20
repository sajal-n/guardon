<!-- GitHub Copilot instructions for contributors and AI agents -->
# Kubernetes Guardrail Extension — Copilot instructions

This file gives targeted, actionable guidance to AI coding assistants working on this repository.

Keep the guidance short and specific: reference the main components, where rules live, how validation flows, and how to run or load the extension locally.

- Repo type: Chrome/Chromium extension (Manifest V3). Key runtime files:
  - `manifest.json` — extension entry, defines service worker and content scripts.
  - `src/background.js` — service worker (background logic placeholder).
  - `src/content.js` — page-injected content script placeholder.
  - `src/popup/*` — popup UI (HTML/CSS/JS).
  - `src/lint/rules.js` — guardrail rules (each rule has id, description, validate function).
  - `src/lint/validator.js` — YAML parsing + rule evaluation using `js-yaml`.

- Big picture: the extension injects `content.js` into pages and exposes a popup UI. The core feature is validating Kubernetes YAML documents using rule functions defined in `src/lint/rules.js`. Validation is performed by parsing YAML with `js-yaml` (dependency in `package.json`) and running each rule's `validate` function against the parsed object.

- Code patterns and conventions to follow or preserve:
  - Rules are plain objects exported from `src/lint/rules.js` with the shape { id, description, validate }. Keep rule functions synchronous and pure (no side effects). Example: a rule checks `yaml.spec?.containers?.some(...)`.
  - Validation functions should accept a single parsed YAML object (not raw text). Parsing happens in `src/lint/validator.js` or popup.
  - Avoid changing `manifest.json` structure unless adding permissions or scripts—explain why manifest changes are required.

- Developer workflows (how to run/test locally):
  1. Install deps: this repo uses `npm` and lists `js-yaml` in `package.json`.
     - Command: open a terminal in the repo and run `npm install`.
  2. Load extension in Chrome/Edge/Brave:
     - Open `chrome://extensions`, enable Developer mode, click "Load unpacked" and select the repository root (this folder contains `manifest.json`).
  3. Debugging:
     - Open the extension popup (toolbar icon) to run popup code. Use DevTools (inspect popup) to view console logs.
     - For background/service worker logs, open Extensions → Service worker (Inspect views).

- Integration points & external dependencies:
  - `js-yaml` is the only runtime dependency. Parsing is done with `yaml.load`.
  - The extension runs in-browser; there are no network calls in the current codebase.

- Files that commonly need edits for new guardrails:
  - `src/lint/rules.js` — add new rule objects. Follow existing rule shape and return boolean `true` when the rule is violated (current code treats truthy as violation).
  - `src/lint/validator.js` — update result shape if you change how rules signal violations. The validator currently maps rules to { rule: description, violated } and returns only violated ones.
  - `src/popup/popup.js` — currently duplicates validator logic; prefer importing from `src/lint/validator.js` and reusing shared functions where possible.

- Tests & linting: there are no automated tests or linters configured. If adding tests, prefer small unit tests around `validateYaml` and individual rule functions.

- Important gotchas discovered in the codebase (copy-edit before changing):
  - `src/popup/popup.js` duplicates the validator implementation rather than importing from `src/lint/validator.js`. Consider consolidating to avoid drift.
  - Rule `validate` functions return a truthy value for violations; validator filters for `violated`. Keep this direction when adding rules.

- Example tasks for AI agents (explicit, small deliverables):
  - Add a new guardrail: "Require resource requests/limits" — edit `src/lint/rules.js` adding a rule that checks container resources.
  - Consolidate validator: refactor `src/popup/popup.js` to import and call `validateYaml` from `src/lint/validator.js`.
  - Add basic unit tests (e.g., using Jest) for `validateYaml`.

If any section is unclear or you need more context (test framework preference, CI, or publishing steps), ask the maintainers for guidance before making broad changes.

---
If you want, I can now implement one of the example tasks (add a rule or consolidate the popup validator). Which should I do first?
