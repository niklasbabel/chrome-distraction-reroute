// Default redirect rules with categories
const defaultRules = {
  productivity: [
    { from: "reddit.com", to: "claude.ai", enabled: false },
    { from: "twitter.com", to: "notion.so", enabled: false },
    { from: "x.com", to: "notion.so", enabled: false },
    { from: "facebook.com", to: "github.com", enabled: false },
    { from: "instagram.com", to: "github.com", enabled: false },
    { from: "tiktok.com", to: "leetcode.com", enabled: false },
    { from: "youtube.com", to: "coursera.org", enabled: false }
  ],
  privacy: [
    { from: "google.com", to: "duckduckgo.com", enabled: false },
    { from: "bing.com", to: "duckduckgo.com", enabled: false },
    { from: "amazon.com", to: "smile.amazon.com", enabled: false }
  ],
  development: [
    { from: "stackoverflow.com", to: "devdocs.io", enabled: false },
    { from: "w3schools.com", to: "mdn.io", enabled: false }
  ],
  news: [
    { from: "cnn.com", to: "reuters.com", enabled: false },
    { from: "foxnews.com", to: "apnews.com", enabled: false },
    { from: "buzzfeed.com", to: "arstechnica.com", enabled: false }
  ],
  custom: [
    { from: "linkedin.com", to: "claude.ai", enabled: true }
  ]
};

// Flatten rules for storage
let redirectRules = Object.values(defaultRules).flat();

// Initialize rules on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['redirectRules'], (result) => {
    if (!result.redirectRules) {
      // First installation - use defaults
      chrome.storage.sync.set({ redirectRules, categories: defaultRules }, () => {
        updateRedirectRules();
      });
    } else {
      // Already installed - keep existing rules
      redirectRules = result.redirectRules;
      updateRedirectRules();
    }
  });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.redirectRules) {
    redirectRules = changes.redirectRules.newValue;
    updateRedirectRules();
  }
});

// Update declarativeNetRequest rules
async function updateRedirectRules() {
  // Remove all existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds
  });

  // Filter only enabled rules
  const enabledRules = redirectRules.filter(rule => rule.enabled && rule.from && rule.to);

  // Helper to build urlFilter supporting wildcards/paths
  const buildFilter = (from) => {
    // If user already provided wildcards or path, use it directly
    if (from.includes('*') || from.includes('/')) {
      // Ensure scheme wildcard prefix
      return from.startsWith('*://') ? from : `*://${from}`;
    }
    // Default domain handling (subdomains + root)
    return [`*://*.${from}/*`, `*://${from}/*`];
  };

  const aggregatedRules = [];

  enabledRules.forEach((rule, idx) => {
    const filters = buildFilter(rule.from);
    (Array.isArray(filters) ? filters : [filters]).forEach((f, i) => {
      aggregatedRules.push({
        id: idx * 10 + i + 1, // deterministic id space
        priority: 1,
        action: {
          type: "redirect",
          // Preserve scheme if user supplied it, default to https otherwise
          redirect: {
            url: rule.to.match(/^https?:\/\//)
              ? rule.to
              : `https://${rule.to}`
          }
        },
        condition: {
          urlFilter: f,
          resourceTypes: ["main_frame"]
        }
      });
    });
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: aggregatedRules
  });
}
