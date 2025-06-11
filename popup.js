let redirectRules = [];
let categories = {};
// toast timeout holder for "Saved" status
let statusTimeout;

// simple debounce util
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Load existing rules
chrome.storage.sync.get(['redirectRules', 'categories'], (result) => {
  redirectRules = result.redirectRules || [];
  categories = result.categories || {};
  renderPresets();
  renderCustomRules();
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    const tabName = e.target.dataset.tab;
    document.getElementById(`${tabName}-content`).classList.add('active');
  });
});

// Render preset rules
function renderPresets() {
  Object.keys(categories).forEach(category => {
    if (category === 'custom') return;
    
    const container = document.getElementById(`${category}-rules`);
    if (!container) return;
    
    container.innerHTML = '';
    
    categories[category].forEach((rule, index) => {
      const ruleDiv = document.createElement('div');
      ruleDiv.className = 'preset-rule';
      ruleDiv.innerHTML = `
        <label class="toggle-label">
          <input type="checkbox" class="toggle" ${rule.enabled ? 'checked' : ''} 
                 data-category="${category}" data-index="${index}">
          <span class="toggle-slider"></span>
          <span class="rule-text">${rule.from} → ${rule.to}</span>
        </label>
      `;
      container.appendChild(ruleDiv);
    });
  });
  
  // Add toggle listeners
  document.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('change', handleToggle);
  });
}

// Handle preset toggle
function handleToggle(e) {
  const category = e.target.dataset.category;
  const index = parseInt(e.target.dataset.index);
  
  // Update in categories
  categories[category][index].enabled = e.target.checked;
  
  // Update in flat redirectRules
  const rule = categories[category][index];
  const flatIndex = redirectRules.indexOf(rule);
  if (flatIndex !== -1) {
    redirectRules[flatIndex].enabled = e.target.checked;
  }
  autoSave();
}

// Centralized save helper (deduped)
function saveNow() {
  // rebuild flat list (keep incomplete custom rules to avoid disappearing rows)
  redirectRules = Object.values(categories).flat();

  chrome.storage.sync.set({ redirectRules, categories }, () => {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'Saved';
      status.style.display = 'block';
      clearTimeout(statusTimeout);
      statusTimeout = setTimeout(() => {
        status.style.display = 'none';
      }, 1500);
    }
  });
}

const autoSave = debounce(saveNow, 300);

// Render custom rules
function renderCustomRules() {
  const container = document.getElementById('rules-container');
  container.innerHTML = '';
  
  const customRules = categories.custom || [];
  
  customRules.forEach((rule, index) => {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule';
    ruleDiv.innerHTML = `
      <input type="checkbox" class="rule-toggle" ${rule.enabled ? 'checked' : ''} 
             data-index="${index}">
      <input type="text" class="from-input" value="${rule.from}" 
             placeholder="from-site.com" data-index="${index}" data-field="from">
      <span class="arrow">→</span>
      <input type="text" class="to-input" value="${rule.to}" 
             placeholder="to-site.com" data-index="${index}" data-field="to">
      <button class="btn btn-danger delete-btn" data-index="${index}">×</button>
    `;
    container.appendChild(ruleDiv);
  });
}

// Handle custom rule input changes
function handleCustomInputChange(e) {
  const index = parseInt(e.target.dataset.index);
  const field = e.target.dataset.field;
  categories.custom[index][field] = e.target.value;
  
  // Update in flat array
  const flatIndex = redirectRules.findIndex(r => r === categories.custom[index]);
  if (flatIndex !== -1) redirectRules[flatIndex][field] = e.target.value;
  autoSave();
}

// Handle custom rule toggle
function handleCustomToggle(e) {
  const index = parseInt(e.target.dataset.index);
  categories.custom[index].enabled = e.target.checked;
  
  // Update in flat array
  const rule = categories.custom[index];
  const flatIndex = redirectRules.findIndex(r => r.from === rule.from && r.to === rule.to);
  if (flatIndex !== -1) redirectRules[flatIndex].enabled = e.target.checked;
  autoSave();
}

// Handle rule deletion
function handleDelete(e) {
  const index = parseInt(e.target.dataset.index);
  const rule = categories.custom[index];
  
  // Remove from categories
  categories.custom.splice(index, 1);
  
  // Remove from flat array
  const flatIndex = redirectRules.findIndex(r => r === rule);
  if (flatIndex !== -1) redirectRules.splice(flatIndex, 1);
  renderCustomRules();
  autoSave();
}

// Add new rule
document.getElementById('add-rule').addEventListener('click', () => {
  const newRule = { from: '', to: '', enabled: true };
  
  if (!categories.custom) {
    categories.custom = [];
  }
  
  categories.custom.push(newRule);
  redirectRules.push(newRule);
  renderCustomRules();
});

// --- Event delegation for custom rules (avoid re-binding every render) ---
const rulesContainer = document.getElementById('rules-container');

// Delegate text input
rulesContainer.addEventListener('input', (e) => {
  if (e.target.matches('.from-input, .to-input')) {
    handleCustomInputChange(e);
  }
});

// Delegate toggle change
rulesContainer.addEventListener('change', (e) => {
  if (e.target.matches('.rule-toggle')) {
    handleCustomToggle(e);
  }
});

// Delegate delete button
rulesContainer.addEventListener('click', (e) => {
  if (e.target.matches('.delete-btn')) {
    handleDelete(e);
  }
});
