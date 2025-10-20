import { validateYaml } from '../lint/validator.js';

// Popup wiring: the popup UI should call `validateYaml` with YAML text
// and render results into `#results`. Keep UI code minimal here so
// validator logic is centralized in `src/lint/validator.js`.

document.addEventListener('DOMContentLoaded', () => {
  const resultsEl = document.getElementById('results');
  // For demo purposes we load the example file if present
  try {
    const example = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: example\nspec:\n  containers:\n    - name: app\n      image: nginx:1.19`;
    const issues = validateYaml(example);
    if (issues && issues.length) {
      resultsEl.textContent = JSON.stringify(issues, null, 2);
    } else {
      resultsEl.textContent = 'No issues found (demo)';
    }
  } catch (e) {
    resultsEl.textContent = 'Error rendering popup';
  }
});
