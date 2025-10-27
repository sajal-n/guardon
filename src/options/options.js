let rules = [];
let editingIndex = null;

const tableBody = document.getElementById("rulesBody");
const form = document.getElementById("form");
const formTitle = document.getElementById("formTitle");

const inputs = {
  id: document.getElementById("ruleId"),
  desc: document.getElementById("ruleDesc"),
  match: document.getElementById("ruleMatch"),
  pattern: document.getElementById("rulePattern"),
  required: document.getElementById("ruleRequired"),
  severity: document.getElementById("ruleSeverity"),
  message: document.getElementById("ruleMessage"),
};

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
    const tdDesc = document.createElement('td'); tdDesc.textContent = r.description || '';
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
    tr.appendChild(tdDesc);
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
  inputs.match.value = r.match;
  inputs.pattern.value = r.pattern || "";
  // r.required may be boolean; convert to string 'true'/'false' for the select
  inputs.required.value = (r.required === true || r.required === 'true') ? 'true' : 'false';
  inputs.severity.value = r.severity;
  inputs.message.value = r.message;
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
    match: inputs.match.value.trim(),
    pattern: inputs.pattern.value.trim(),
    required: inputs.required.value === "true",
    severity: inputs.severity.value,
    message: inputs.message.value.trim(),
  };

  if (!newRule.id || !newRule.match) {
    showToast('ID and Match path are required!', { background: '#b91c1c' });
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
  const text = await navigator.clipboard.readText();
  try {
    const imported = JSON.parse(text);
    rules = imported;
    saveRules();
    renderTable();
    showToast('Imported from clipboard!', { background: '#0ea5e9' });
  } catch {
    showToast('Clipboard does not contain valid JSON!', { background: '#b91c1c' });
  }
};

document.getElementById("exportRules").onclick = () => {
  navigator.clipboard.writeText(JSON.stringify(rules, null, 2))
    .then(() => alert("Exported to clipboard!"))
    .catch(() => alert("Failed to copy to clipboard."));
};

// replace remaining alerts for export
document.getElementById("exportRules").onclick = () => {
  navigator.clipboard.writeText(JSON.stringify(rules, null, 2))
    .then(() => showToast('Exported to clipboard!', { background: '#0ea5e9' }))
    .catch(() => showToast('Failed to copy to clipboard.', { background: '#b91c1c' }));
};
