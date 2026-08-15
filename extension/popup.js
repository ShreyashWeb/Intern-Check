import { analyzeText } from './analyzer.js';

// Global App State
let appState = {
  score: 100,
  triggeredFlags: [],
  explainMode: false,
  extractedText: "",
  pageTitle: "",
  sourceInfo: "",
  pageUrl: ""
};

// DOM Elements
const initialPanel = document.getElementById('initial-panel');
const loadingPanel = document.getElementById('loading-panel');
const resultsPanel = document.getElementById('results-panel');

const checkBtn = document.getElementById('check-btn');
const resetBtn = document.getElementById('reset-btn');
const loadingText = document.getElementById('loading-text');

const scoreCircle = document.getElementById('score-circle');
const scoreValue = document.getElementById('score-value');
const ratingBadge = document.getElementById('rating-badge');
const ratingSubtext = document.getElementById('rating-subtext');
const sourceTag = document.getElementById('source-tag');

const flagsCounter = document.getElementById('flag-counter');
const explainToggle = document.getElementById('explain-mode-toggle');
const flagsList = document.getElementById('flags-list');

const adviceCard = document.getElementById('advice-card');
const adviceIcon = document.getElementById('advice-icon');
const adviceText = document.getElementById('advice-text');

// Content Extraction Function (executed on-tab)
// Scopes extraction to main job description area to avoid navbar/footer/cookie banner false-positives
function extractMainContent() {
  const selectors = [
    '.show-more-less-html__markup', // LinkedIn Jobs description markup
    '.view_detail_body',           // Internshala internship details block
    '.job-description',            // Common job board class
    '#job-description',            // Common job board ID
    '.job-desc',                   // Common job board class
    '.jd-desc',                    // Naukri description wrapper
    'article',                     // HTML5 semantic content container
    'main',                        // HTML5 main container
    '#content',                    // Common content area ID
    '.content'                     // Common content area class
  ];

  // Try specific selectors first
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.trim().length > 150) {
      return {
        title: document.title,
        text: element.innerText.trim(),
        source: `Selector: ${selector}`,
        url: window.location.href
      };
    }
  }

  // Fallback heuristic: Traverse body, exclude boilerplate elements, and find the text-heavy container
  const ignoredTags = ['nav', 'header', 'footer', 'script', 'style', 'noscript', 'iframe', 'aside', 'svg'];
  let bestElement = null;
  let maxLen = 0;

  function traverse(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (ignoredTags.includes(tagName)) return;

      const text = node.innerText || '';
      if (text.length > maxLen) {
        maxLen = text.length;
        bestElement = node;
      }

      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  }

  traverse(document.body);

  if (bestElement && maxLen > 120) {
    return {
      title: document.title,
      text: bestElement.innerText.trim(),
      source: 'Heuristic: Longest content block (nav/footer excluded)',
      url: window.location.href
    };
  }

  return {
    title: document.title,
    text: document.body.innerText.trim(),
    source: 'Fallback: Full page text',
    url: window.location.href
  };
}

// Event Listeners
checkBtn.addEventListener('click', runCheck);
resetBtn.addEventListener('click', resetUI);
explainToggle.addEventListener('change', (e) => {
  appState.explainMode = e.target.checked;
  renderFlagsList();
});

// Main execution logic
async function runCheck() {
  // 1. Show loading state
  initialPanel.classList.add('hidden');
  loadingPanel.classList.remove('hidden');
  loadingText.textContent = "Querying current tab...";

  try {
    // 2. Query the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error("No active tab found. Please make sure you are on a webpage.");
    }

    // Guard against internal browser URLs where execution is blocked
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error("Cannot run checks on browser internal pages. Please open a job posting website.");
    }

    loadingText.textContent = "Scoping page content...";

    // 3. Inject content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMainContent
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error("Unable to extract text from the page. Try again or check permissions.");
    }

    const pageData = results[0].result;
    
    appState.pageTitle = pageData.title;
    appState.extractedText = pageData.text;
    appState.sourceInfo = pageData.source;
    appState.pageUrl = pageData.url;

    loadingText.textContent = "Analyzing patterns...";

    // Simulate analysis delay (450ms) for premium feel / loading UX
    setTimeout(() => {
      // 4. Run Analysis
      const analysis = analyzeText(appState.extractedText);
      
      appState.score = analysis.score;
      appState.triggeredFlags = analysis.triggeredFlags;

      // 5. Render
      renderResults();
      
      loadingPanel.classList.add('hidden');
      resultsPanel.classList.remove('hidden');
    }, 450);

  } catch (error) {
    showError(error.message);
  }
}

// Render Results Panel
function renderResults() {
  // Score display
  scoreValue.textContent = appState.score;
  
  // Animate circle gauge (Circumference = 2 * PI * 40 = 251.32)
  const circumference = 251.32;
  const offset = circumference - (appState.score / 100) * circumference;
  scoreCircle.style.strokeDashoffset = offset;
  
  // Theme styling based on score severity
  const severityColor = getSeverityColor(appState.score);
  scoreCircle.style.stroke = severityColor;
  
  // Rating level badge
  ratingBadge.className = "rating-badge"; // reset
  adviceCard.className = "advice-card card"; // reset
  
  let host = "";
  try {
    host = new URL(appState.pageUrl).hostname;
  } catch (e) {
    host = appState.pageTitle;
  }
  sourceTag.textContent = `Scanned: ${host} (${appState.sourceInfo})`;

  if (appState.score >= 85) {
    ratingBadge.classList.add('rating-safe');
    ratingBadge.textContent = "Highly Credible";
    ratingSubtext.textContent = "No significant scam patterns detected in the main content area.";
    
    adviceIcon.textContent = "🛡️";
    adviceText.textContent = "This listing matches normal recruitment patterns. Double-check official corporate domains before submitting credentials.";
    adviceCard.classList.add('advice-safe');
  } else if (appState.score >= 50) {
    ratingBadge.classList.add('rating-caution');
    ratingBadge.textContent = "Moderate Risk";
    ratingSubtext.textContent = "Detected potential risks or missing details in the description.";
    
    adviceIcon.textContent = "⚠️";
    adviceText.textContent = "Proceed with caution. Do not buy training courses or make deposits, even if refundable. Check the company credibility.";
    adviceCard.classList.add('advice-caution');
  } else {
    ratingBadge.classList.add('rating-danger');
    ratingBadge.textContent = "High Risk";
    ratingSubtext.textContent = "Multiple critical scam indicator flags match this posting.";
    
    adviceIcon.textContent = "🚨";
    adviceText.textContent = "Do not apply! This description contains warning triggers identical to known recruitment fraud patterns.";
    adviceCard.classList.add('advice-danger');
  }
  
  // Update flag count UI
  const flagCount = appState.triggeredFlags.length;
  flagsCounter.textContent = `${flagCount} Flag${flagCount !== 1 ? 's' : ''}`;
  flagsCounter.className = "flag-counter"; // reset
  
  if (appState.score < 50) {
    flagsCounter.classList.add('danger-count');
  } else if (appState.score < 85) {
    flagsCounter.classList.add('warning-count');
  }
  
  // Render flags
  renderFlagsList();

  // Update debug preview element
  const debugPreviewEl = document.getElementById('debug-text-preview');
  if (debugPreviewEl) {
    debugPreviewEl.textContent = appState.extractedText.slice(0, 200) + 
      (appState.extractedText.length > 200 ? '...' : '');
  }
}

// Render individual flag list elements
function renderFlagsList() {
  flagsList.innerHTML = '';
  
  if (appState.triggeredFlags.length === 0) {
    const emptyFlags = document.createElement('div');
    emptyFlags.className = 'empty-flags-placeholder';
    emptyFlags.textContent = 'No matching red flags found in this page content.';
    flagsList.appendChild(emptyFlags);
    return;
  }
  
  appState.triggeredFlags.forEach(flag => {
    const item = document.createElement('div');
    const isWarning = flag.tier === 'soft-signal' || flag.id === 'short_desc';
    item.className = `flag-item ${isWarning ? 'flag-warning' : 'flag-danger'}`;
    
    const descText = appState.explainMode ? flag.simplified : flag.explanation;
    
    item.innerHTML = `
      <div class="flag-item-header">
        <span class="flag-item-name">${flag.name}</span>
        <span class="flag-item-deduction">-${flag.deduction} pts</span>
      </div>
      <div class="flag-snippet-box">
        Context: "${flag.snippet}"
      </div>
      <p class="flag-item-desc">${descText}</p>
    `;
    flagsList.appendChild(item);
  });
}

// Helper: Get color based on score
function getSeverityColor(score) {
  if (score >= 85) return 'var(--color-success)'; // Emerald
  if (score >= 50) return 'var(--color-warning)'; // Amber
  return 'var(--color-danger)'; // Crimson
}

// Error handling page display
function showError(message) {
  loadingPanel.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  initialPanel.classList.remove('hidden');
  alert(`InternCheck Error: ${message}`);
}

// Reset view
function resetUI() {
  resultsPanel.classList.add('hidden');
  initialPanel.classList.remove('hidden');
  explainToggle.checked = false;
  appState.explainMode = false;
}
