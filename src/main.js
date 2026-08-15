import { rules } from './rules.js';
import { extractSkills } from './skills.js';

// Pre-defined templates for demoing
const templates = {
  legit: `Software Engineer Intern
Company: Acme Tech Solutions
Location: Bangalore, India (Hybrid)
Stipend: ₹25,000 / month

About the Role:
We are looking for a Software Engineer Intern to join our core engineering team. You will work alongside senior engineers to design, build, and maintain our cloud-based microservices.

Requirements:
- Basic knowledge of JavaScript, Node.js, and React.
- Familiarity with Git version control.
- Good problem-solving and communication skills.

Benefits:
- Monthly stipend
- Mentorship from senior engineers
- Potential for full-time conversion based on performance`,

  paid_training: `Web Development Intern (Guaranteed Placement)
Company: Global Edutech Careers
Location: Remote

Get a guaranteed job offer after completing our internship training program! 
We are looking for interns who want to gain real-world experience in frontend development. 

Note: To confirm your internship, you are required to purchase our HTML/CSS/React certification course bundle. The placement fee of Rs. 4,999 must be paid upfront to guarantee your placement and certificate.

Apply today to secure your career!`,

  fee_scam: `Data Entry Clerk / Intern
Company: Direct Careers Ltd.
Location: Work from Home

We are hiring urgent Data Entry Interns. Simple copy-paste work.
Stipend: Rs. 15,000 - 30,000 per week.

How to Apply:
All selected candidates must pay a refundable registration fee of Rs. 450 to cover administrative charges and software setup. Once the registration fee is paid, your credentials will be generated.

Immediate joining! No experience required.`,

  whatsapp_task: `Social Media Marketing Assistant
Company: Global Growth Marketing
Location: Remote

Boost your income by performing simple social media tasks like sharing posts, writing comments, and rating products.

Requirements:
- Must have a smartphone and active WhatsApp.
- Direct recruitment via WhatsApp group. To get started, please join our Telegram group at t.me/globaltasks_recruits or contact on WhatsApp at +91-9988776655.
- Recruit 3 people to join this program to unlock your weekly bonus payouts!`,

  borderline: `Graphic Design Intern
Company: Creative Studio Co.
Location: Remote

We are looking for a creative Graphic Design Intern to assist with social media graphics and marketing collateral.

Requirements:
- Basic knowledge of Photoshop and Illustrator.
- Ability to work 15-20 hours per week.

Please note: This is an unpaid internship position. However, we offer college credits and a letter of recommendation upon completion.
To apply, please join our WhatsApp group for applicant screening: chat.whatsapp.com/example-invite`
};

// Global App State
let appState = {
  currentScore: 100,
  triggeredFlags: [],
  explainMode: false,
  rawText: "",
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  activeUrl: "",
  reports: [],
  reportsSummary: { total: 0, categories: {} },
  
  // V4 Resume Upload & Skill Match State
  resumeSkills: [],
  resumeFileName: "",
  
  // V5 Domain Verification State
  domainAgeDays: null,
  
  // V6 Verification State
  verification: null
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// DOM Elements
const textarea = document.getElementById('description-input');
const urlInput = document.getElementById('url-input');
const clearBtn = document.getElementById('clear-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const emptyState = document.getElementById('empty-state');
const resultsContent = document.getElementById('results-content');
const scoreCircle = document.getElementById('score-circle');
const scoreValue = document.getElementById('score-value');
const ratingBadge = document.getElementById('rating-badge');
const ratingSubtext = document.getElementById('rating-subtext');
const flagsCounter = document.getElementById('flag-counter');
const explainToggle = document.getElementById('explain-mode-toggle');
const flagsList = document.getElementById('flags-list');
const adviceIcon = document.getElementById('advice-icon');
const adviceText = document.getElementById('advice-text');
const adviceCard = document.querySelector('.advice-card');

// Auth elements
const authHeaderSection = document.getElementById('auth-header-section');
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth-btn');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabSignupBtn = document.getElementById('tab-signup-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Reports elements
const reportsCard = document.getElementById('reports-card');
const reportsCountBadge = document.getElementById('reports-count-badge');
const reportsSummaryBox = document.getElementById('reports-summary-box');
const reportsList = document.getElementById('reports-list');
const newReportSection = document.getElementById('new-report-section');

// V4 Resume Upload & Skill Match Elements
const resumeUploadZone = document.getElementById('resume-upload-zone');
const resumeFileInput = document.getElementById('resume-file-input');
const resumeStatusCard = document.getElementById('resume-status-card');
const resumeFileNameText = document.getElementById('resume-file-name');
const resumeSkillsBadge = document.getElementById('resume-skills-badge');
const clearResumeBtn = document.getElementById('clear-resume-btn');

const skillMatchContainer = document.getElementById('skill-match-container');
const skillMatchPlaceholder = document.getElementById('skill-match-placeholder');
const skillMatchDetails = document.getElementById('skill-match-details');
const skillMatchValue = document.getElementById('skill-match-value');
const matchedSkillsBadges = document.getElementById('matched-skills-badges');
const gapSkillsBadges = document.getElementById('gap-skills-badges');

// V5 Domain Verification Elements
const domainAgeBadge = document.getElementById('domain-age-badge');
const domainAgeText = document.getElementById('domain-age-text');

// Helper: Show/Hide Clear button based on input content
function toggleClearBtn() {
  if (textarea.value.trim().length > 0) {
    clearBtn.style.display = 'flex';
  } else {
    clearBtn.style.display = 'none';
  }
}

textarea.addEventListener('input', toggleClearBtn);

// Clear textarea
clearBtn.addEventListener('click', () => {
  textarea.value = '';
  toggleClearBtn();
  textarea.focus();
});

// Setup Template Selection
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const templateKey = e.currentTarget.getAttribute('data-template');
    if (templates[templateKey]) {
      textarea.value = templates[templateKey];
      toggleClearBtn();
      
      // Auto-analyze template selection for quick verification
      analyzeDescription();
    }
  });
});

// Analyze Input Text
async function analyzeDescription() {
  const text = textarea.value.trim();
  
  if (!text) {
    alert("Please enter or paste an internship description to analyze.");
    return;
  }
  
  // Show spinner state on button
  analyzeBtn.classList.add('loading');
  analyzeBtn.disabled = true;
  const btnSpinner = analyzeBtn.querySelector('.btn-spinner');
  const btnText = analyzeBtn.querySelector('span');
  btnSpinner.style.display = 'inline-block';
  btnText.textContent = 'Analyzing...';

  // 1. Independent Domain Verification Fetch (V5)
  const urlVal = urlInput.value.trim();
  if (urlVal) {
    try {
      // Fetch domain check from backend with a timeout check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds fetch timeout
      
      const res = await fetch(`${BACKEND_URL}/verify-domain?url=${encodeURIComponent(urlVal)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        appState.domainAgeDays = data.age_days;
      } else {
        appState.domainAgeDays = null;
      }
    } catch (err) {
      console.warn("Domain age verification network failure:", err.message);
      appState.domainAgeDays = null;
    }
  } else {
    appState.domainAgeDays = null;
  }

  // Simulate a fast analysis delay for premium feel
  setTimeout(() => {
    runAnalysis(text);
    
    // Reset button state
    analyzeBtn.classList.remove('loading');
    analyzeBtn.disabled = false;
    btnSpinner.style.display = 'none';
    btnText.textContent = 'Check Reality Score';
  }, 300);
}

analyzeBtn.addEventListener('click', analyzeDescription);

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to extract the full sentence or clause containing the match
function extractSentence(text, matchIndex, matchedLength) {
  let start = 0;
  for (let i = matchIndex - 1; i >= 0; i--) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    if (char === '\n' || char === '\r') {
      start = i + 1;
      break;
    }
    if ((char === '.' || char === '!' || char === '?') && (i === text.length - 1 || /\s/.test(text[i + 1]))) {
      // Check if not preceded by abbreviations to avoid breaking
      const isRs = prevChar && (prevChar.toLowerCase() === 's' && i >= 2 && text[i - 2].toLowerCase() === 'r');
      const isNo = prevChar && (prevChar.toLowerCase() === 'o' && i >= 2 && text[i - 2].toLowerCase() === 'n');
      if (!isRs && !isNo) {
        start = i + 1;
        break;
      }
    }
  }

  let end = text.length;
  for (let i = matchIndex + matchedLength; i < text.length; i++) {
    const char = text[i];
    const nextChar = i < text.length - 1 ? text[i + 1] : '';
    if (char === '\n' || char === '\r') {
      end = i;
      break;
    }
    if ((char === '.' || char === '!' || char === '?') && (i === text.length - 1 || /\s/.test(nextChar))) {
      const prevChar = text[i - 1] || '';
      const prevPrevChar = i >= 2 ? text[i - 2] : '';
      const isRs = prevChar.toLowerCase() === 's' && prevPrevChar.toLowerCase() === 'r';
      const isNo = prevChar.toLowerCase() === 'o' && prevPrevChar.toLowerCase() === 'n';
      if (!isRs && !isNo) {
        end = i + 1; // Include the punctuation mark itself
        break;
      }
    }
  }

  let sentence = text.substring(start, end).trim();
  sentence = sentence.replace(/\s+/g, ' ');

  if (!sentence) {
    const fbStart = Math.max(0, matchIndex - 25);
    const fbEnd = Math.min(text.length, matchIndex + matchedLength + 25);
    sentence = text.substring(fbStart, fbEnd).trim().replace(/\s+/g, ' ');
  }

  return sentence;
}

// Main Analysis Logic
function runAnalysis(text) {
  appState.rawText = text;
  appState.triggeredFlags = [];
  appState.verification = null;
  updateVerifiedBadge();
  
  const hardBlockMatches = [];
  const softSignalMatches = [];
  
  // Iterate through all defined rules
  rules.forEach(rule => {
    const match = text.match(rule.regex);
    if (match) {
      const matchedStr = match[0];
      const matchIndex = match.index;
      
      // Extract sentence context
      const sentence = extractSentence(text, matchIndex, matchedStr.length);
      
      // Escape HTML
      const safeSentence = escapeHTML(sentence);
      const safeMatchedStr = escapeHTML(matchedStr);
      
      // Highlight matched keyword (case-insensitive search)
      const highlightRegex = new RegExp(escapeRegExp(safeMatchedStr), 'i');
      const highlighted = safeSentence.replace(highlightRegex, (m) => `<strong>${m}</strong>`);
      
      const flagInfo = {
        ...rule,
        snippet: highlighted
      };
      
      if (rule.tier === 'hard-block') {
        hardBlockMatches.push(flagInfo);
      } else {
        softSignalMatches.push(flagInfo);
      }
    }
  });
  
  // V5: Add domain age soft signal if domain is younger than 90 days
  if (appState.domainAgeDays !== null && appState.domainAgeDays < 90) {
    const youngDomainFlag = {
      id: "young_domain",
      name: "Recently Registered Domain",
      category: "Credibility",
      deduction: 10,
      explanation: `The domain of the listing URL was registered recently (${appState.domainAgeDays} days ago). Scam sites are frequently created on new domains and discarded quickly.`,
      simplified: `⚠️ Caution: This website was registered very recently (${appState.domainAgeDays} days ago). Scam websites are often set up on brand new domains.`,
      snippet: `Domain is only ${appState.domainAgeDays} days old.`
    };
    softSignalMatches.push(youngDomainFlag);
  }
  
  // Apply soft-signal co-occurrence filter (needs at least 2 distinct soft signals)
  let activeSoftSignals = [];
  if (softSignalMatches.length >= 2) {
    activeSoftSignals = softSignalMatches;
  }
  
  appState.triggeredFlags = [...hardBlockMatches, ...activeSoftSignals];
  
  let score = 100;
  appState.triggeredFlags.forEach(flag => {
    score -= flag.deduction;
  });
  
  // Hard-block ceiling: score cannot exceed 35 if a hard block is triggered
  if (hardBlockMatches.length > 0) {
    score = Math.min(score, 35);
  }
  
  // Apply a small warning for extremely short descriptions
  if (text.length < 60) {
    const shortDescRule = {
      id: "short_desc",
      name: "Extremely Short Job Description",
      category: "Credibility",
      deduction: 15,
      explanation: "The description is extremely short or lacks details. Legitimate internships usually provide a clear scope of work, skills required, and learning outcomes.",
      simplified: "⚠️ Caution: There is barely any description here. Real companies write details about what you will learn and do. Be careful!",
      snippet: `Description is only ${text.length} characters long.`
    };
    appState.triggeredFlags.push(shortDescRule);
    score -= shortDescRule.deduction;
  }
  
  // Floor the score at 0 so it can never display as negative
  score = Math.max(0, score);
  
  // Enforce score bounds [0, 100]
  appState.currentScore = Math.max(0, Math.min(100, score));
  
  // Extract technical skills from listing text (V4)
  appState.jobSkills = extractSkills(text);

  // Render results
  renderResults();

  // V3: Query reports if an internship URL is provided
  const urlVal = urlInput.value.trim();
  if (urlVal) {
    appState.activeUrl = urlVal;
    fetchReports(urlVal);
  } else {
    appState.activeUrl = "";
    appState.reports = [];
    appState.reportsSummary = { total: 0, categories: {} };
    renderReports();
  }
}

// Render the results panels
function renderResults() {
  emptyState.classList.add('hidden');
  resultsContent.classList.remove('hidden');
  resultsContent.classList.remove('animate-results');
  void resultsContent.offsetWidth; // trigger reflow to restart animation
  resultsContent.classList.add('animate-results');
  
  // Set score text
  scoreValue.textContent = appState.currentScore;
  
  // Animate circular progress gauge
  // Circumference of R=50 circle is 2 * Math.PI * 50 = 314.16
  const circumference = 314.16;
  const offset = circumference - (appState.currentScore / 100) * circumference;
  
  // Apply stroke-dashoffset to animate it
  scoreCircle.style.strokeDashoffset = offset;
  
  // Style according to score severity
  scoreCircle.style.stroke = getSeverityColor(appState.currentScore);
  
  // Rating level styling
  ratingBadge.className = "rating-badge"; // reset classes
  adviceCard.className = "advice-card card"; // reset classes
  
  if (appState.currentScore >= 85) {
    ratingBadge.classList.add('rating-safe');
    ratingBadge.textContent = "Highly Credible";
    ratingSubtext.textContent = "No significant scam patterns detected. Standard application checks apply.";
    
    adviceIcon.textContent = "🛡️";
    adviceText.textContent = "This listing matches normal recruitment patterns. Double-check the company domain (e.g. ensure email comes from official company.com domain) and apply safely.";
    adviceCard.classList.add('advice-safe');
  } else if (appState.currentScore >= 50) {
    ratingBadge.classList.add('rating-caution');
    ratingBadge.textContent = "Moderate Risk / Caution";
    ratingSubtext.textContent = "Detected suspicious elements. Review terms carefully.";
    
    adviceIcon.textContent = "⚠️";
    adviceText.textContent = "Proceed with caution. Do not buy any training courses or pay any deposit, even if promised a full refund. Verify company contact credentials before signing anything.";
    adviceCard.classList.add('advice-caution');
  } else {
    ratingBadge.classList.add('rating-danger');
    ratingBadge.textContent = "High Risk / Unsafe";
    ratingSubtext.textContent = "Multiple critical red flags detected. Highly likely to be a scam.";
    
    adviceIcon.textContent = "🚨";
    adviceText.textContent = "Do not apply! This description matches known internship scam patterns (upfront fees, course-selling, or chain recruitment). Protect your money and personal data.";
    adviceCard.classList.add('advice-danger');
  }
  
  // Update flag list and count
  const count = appState.triggeredFlags.length;
  flagsCounter.textContent = `${count} Flag${count !== 1 ? 's' : ''}`;
  
  flagsCounter.className = "flag-counter"; // reset
  if (appState.currentScore < 50) {
    flagsCounter.classList.add('danger-count');
  } else if (appState.currentScore < 85) {
    flagsCounter.classList.add('warning-count');
  }
  
  renderFlagsList();
  
  // Render Skill Match dashboard section (V4)
  renderSkillMatch();

  // V5: Render Domain Age Fact
  const urlVal = urlInput.value.trim();
  if (urlVal) {
    domainAgeBadge.classList.remove('hidden');
    if (appState.domainAgeDays !== null) {
      if (appState.domainAgeDays >= 365) {
        const years = Math.round((appState.domainAgeDays / 365) * 10) / 10;
        domainAgeText.textContent = `Domain registered: ${years} year${years !== 1 ? 's' : ''} ago`;
      } else {
        domainAgeText.textContent = `Domain registered: ${appState.domainAgeDays} days ago`;
      }
    } else {
      domainAgeText.textContent = "Domain age: unavailable";
    }
  } else {
    domainAgeBadge.classList.add('hidden');
  }
  
  // V6: Update Verified Badge
  updateVerifiedBadge();
}

// Render individual flag elements
function renderFlagsList() {
  flagsList.innerHTML = '';
  
  if (appState.triggeredFlags.length === 0) {
    const emptyFlags = document.createElement('div');
    emptyFlags.className = 'empty-flags-placeholder';
    emptyFlags.style.textAlign = 'center';
    emptyFlags.style.color = 'var(--text-muted)';
    emptyFlags.style.padding = '2rem 1rem';
    emptyFlags.style.fontSize = '0.85rem';
    emptyFlags.textContent = 'Awesome! No red flag matches found in this text.';
    flagsList.appendChild(emptyFlags);
    return;
  }
  
  appState.triggeredFlags.forEach((flag, index) => {
    const item = document.createElement('div');
    // Decide if it's warning or danger based on tier or short desc
    const isWarning = flag.tier === 'soft-signal' || flag.id === 'short_desc';
    item.className = `flag-item ${isWarning ? 'flag-warning' : 'flag-danger'}`;
    item.style.setProperty('--flag-index', index);
    
    const descText = appState.explainMode ? flag.simplified : flag.explanation;
    const iconName = isWarning ? 'alert-triangle' : 'alert-circle';
    
    item.innerHTML = `
      <div class="flag-item-header">
        <div class="flag-title-with-icon">
          <i data-lucide="${iconName}" class="flag-icon"></i>
          <span class="flag-item-name">${flag.name}</span>
        </div>
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

// Toggle explain mode
explainToggle.addEventListener('change', (e) => {
  appState.explainMode = e.target.checked;
  renderFlagsList();
});

// Helper: Escape HTML to avoid injection
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// V3 Backend API Integration Logic
// -------------------------------------------------------------

// Fetch reports for current URL from server
async function fetchReports(url) {
  try {
    const res = await fetch(`${BACKEND_URL}/reports?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch reports: ${res.status}`);
    }
    const data = await res.json();
    appState.reports = data.reports;
    appState.reportsSummary = data.summary;
    appState.verification = data.verification;
    renderReports();
    updateVerifiedBadge();
  } catch (err) {
    console.error("Fetch reports error:", err.message);
    reportsList.innerHTML = `<div class="reports-empty-state">Unable to load reports from database server. Check connection.</div>`;
  }
}

// Helper to pre-populate title and company name from pasted description
function guessTitleAndCompany(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let title = "Web Intern";
  let company = "Apex Digital";
  
  if (lines.length > 0) {
    title = lines[0].substring(0, 50);
  }
  if (lines.length > 1) {
    const companyMatch = lines[1].match(/(?:company|employer|organisation)\s*:\s*(.+)/i);
    if (companyMatch) {
      company = companyMatch[1].substring(0, 50);
    } else {
      company = lines[1].substring(0, 50);
    }
  }
  return { title, company };
}

// Render the reports card dashboard
function renderReports() {
  const total = appState.reportsSummary.total;
  
  // Update count badge
  reportsCountBadge.textContent = `${total} Report${total !== 1 ? 's' : ''}`;
  
  // Render Summary Box
  if (total > 0) {
    reportsSummaryBox.classList.remove('hidden');
    let summaryText = `<strong>${total} Report${total !== 1 ? 's' : ''} submitted by the community:</strong> `;
    const categoriesList = [];
    for (const [cat, count] of Object.entries(appState.reportsSummary.categories)) {
      categoriesList.push(`${count} ${cat.toLowerCase()}-related`);
    }
    summaryText += categoriesList.join(', ');
    reportsSummaryBox.innerHTML = summaryText;
  } else {
    reportsSummaryBox.classList.add('hidden');
  }

  // Render List of Reports
  reportsList.innerHTML = '';
  if (appState.reports.length === 0) {
    reportsList.innerHTML = `
      <div class="reports-empty-state">
        🛡️ No community reports found for this URL. Be the first to report it if something seems suspicious!
      </div>
    `;
  } else {
    appState.reports.forEach(report => {
      const item = document.createElement('div');
      item.className = 'report-item';
      
      const date = new Date(report.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      
      const isPositive = report.report_type === 'positive';
      const typeIcon = isPositive ? 'check-circle' : 'x-circle';
      item.innerHTML = `
        <div class="report-meta">
          <span class="reporter-name">Reporter: ${escapeHTML(report.user_name || 'Anonymous')}</span>
          <span class="report-type-badge ${isPositive ? 'type-positive' : 'type-concern'}">
            <i data-lucide="${typeIcon}"></i> ${isPositive ? 'Legitimate' : 'Concern'}
          </span>
          <span>${date}</span>
        </div>
        <span class="report-reason-badge">${escapeHTML(report.reason)}</span>
        <p class="report-desc">${escapeHTML(report.description)}</p>
      `;
      reportsList.appendChild(item);
    });
  }

  // Render the submission form section
  renderReportFormSection();
}

// Render Form or Auth link inside the reports container
function renderReportFormSection() {
  newReportSection.innerHTML = '';

  if (!appState.activeUrl) {
    newReportSection.innerHTML = `
      <div class="auth-prompt">
        ℹ️ Paste an internship URL in the input field above to check or submit community reports.
      </div>
    `;
    return;
  }

  if (!appState.user) {
    newReportSection.innerHTML = `
      <div class="auth-prompt">
        🔒 You must be signed in to submit a community report. 
        <button id="auth-prompt-btn" class="auth-prompt-link">Sign In / Register Now</button>
      </div>
    `;
    document.getElementById('auth-prompt-btn').addEventListener('click', () => openAuthModal('login'));
    return;
  }

  // Pre-fill guesses from description box
  const guesses = guessTitleAndCompany(textarea.value.trim());

  newReportSection.innerHTML = `
    <h4>Submit a Community Report</h4>
    <form id="new-report-form" class="auth-form">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label for="report-company">Company Name</label>
          <input type="text" id="report-company" required value="${escapeHTML(guesses.company)}" />
        </div>
        <div class="form-group">
          <label for="report-title">Job Title</label>
          <input type="text" id="report-title" required value="${escapeHTML(guesses.title)}" />
        </div>
      </div>
      
      <!-- V6 Experience Type Selection -->
      <div class="form-group">
        <label>Experience Type</label>
        <div class="report-type-toggle-group">
          <label class="report-type-radio-label">
            <input type="radio" name="report_type" value="concern" checked />
            <span>⚠️ I have a concern / found a scam pattern</span>
          </label>
          <label class="report-type-radio-label">
            <input type="radio" name="report_type" value="positive" />
            <span>✅ This was a good experience / legitimate listing</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="report-reason">Reason for Reporting</label>
        <select id="report-reason" required>
          <option value="Financial Requirement">Financial Requirement (Fees / Mandatory Courses / Deposits)</option>
          <option value="Compensation">Compensation Issues (Unpaid Commercial Work / Fake Pay Claims)</option>
          <option value="Business Model">MLM / Chain Recruitment / Product Selling</option>
          <option value="Communication">Suspicious Communication Channels (WhatsApp / Telegram recruiting)</option>
          <option value="Legitimate Experience">Legitimate Experience (Smooth hiring, real stipend, etc.)</option>
          <option value="Other">Other / Vague Details / Non-existent Company</option>
        </select>
      </div>
      <div class="form-group">
        <label for="report-description">Description of activities</label>
        <textarea id="report-description" required rows="3" placeholder="Provide details about your experience..."></textarea>
      </div>
      <div class="form-error" id="report-form-error"></div>
      <button type="submit" class="primary-btn" id="submit-report-btn">Submit Report</button>
    </form>
  `;

  document.getElementById('new-report-form').addEventListener('submit', submitReport);
}

// -------------------------------------------------------------
// Authentication UX Handlers
// -------------------------------------------------------------

// Toggle Auth elements in header
function updateAuthUI() {
  authHeaderSection.innerHTML = '';
  
  if (appState.user) {
    authHeaderSection.innerHTML = `
      <div class="user-profile-header">
        <span>Hello, <strong class="user-name-display">${escapeHTML(appState.user.name)}</strong></span>
        <button id="logout-btn" class="auth-btn">Logout</button>
      </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    authHeaderSection.innerHTML = `
      <button id="login-trigger-btn" class="auth-btn">Sign In / Register</button>
    `;
    document.getElementById('login-trigger-btn').addEventListener('click', () => openAuthModal('login'));
  }
}

// Open Login/Signup Modal
function openAuthModal(tab) {
  authModal.classList.remove('hidden');
  loginError.textContent = '';
  signupError.textContent = '';
  loginForm.reset();
  signupForm.reset();

  if (tab === 'login') {
    tabLoginBtn.classList.add('active');
    tabSignupBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    tabSignupBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

// Close Modal
function closeAuthModal() {
  authModal.classList.add('hidden');
}

// User logout handler
function logout() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  appState.user = null;
  appState.token = null;
  updateAuthUI();
  renderReportFormSection();
}

// Submit POST Login
async function submitLogin(e) {
  e.preventDefault();
  loginError.textContent = '';
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    appState.user = data.user;
    appState.token = data.token;

    updateAuthUI();
    closeAuthModal();
    renderReportFormSection();

  } catch (err) {
    loginError.textContent = err.message;
  }
}

// Submit POST Signup
async function submitSignup(e) {
  e.preventDefault();
  signupError.textContent = '';

  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  if (password.length < 6) {
    signupError.textContent = "Password must be at least 6 characters long.";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Signup failed.');
    }

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    appState.user = data.user;
    appState.token = data.token;

    updateAuthUI();
    closeAuthModal();
    renderReportFormSection();

  } catch (err) {
    signupError.textContent = err.message;
  }
}

// Submit POST Report
async function submitReport(e) {
  e.preventDefault();
  const formError = document.getElementById('report-form-error');
  formError.textContent = '';

  const submitBtn = document.getElementById('submit-report-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const company_name = document.getElementById('report-company').value;
  const title = document.getElementById('report-title').value;
  const reason = document.getElementById('report-reason').value;
  const description = document.getElementById('report-description').value;
  const report_type = document.querySelector('input[name="report_type"]:checked').value;

  try {
    const res = await fetch(`${BACKEND_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.token}`
      },
      body: JSON.stringify({
        source_url: appState.activeUrl,
        company_name,
        title,
        reason,
        description,
        report_type
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Report submission failed.');
    }

    // Refresh reports list
    fetchReports(appState.activeUrl);

  } catch (err) {
    formError.textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report';
  }
}

// -------------------------------------------------------------
// Bind Listeners & Initialize
// -------------------------------------------------------------

// Open auth modal listeners
if (document.getElementById('login-trigger-btn')) {
  document.getElementById('login-trigger-btn').addEventListener('click', () => openAuthModal('login'));
}

closeAuthBtn.addEventListener('click', closeAuthModal);
tabLoginBtn.addEventListener('click', () => openAuthModal('login'));
tabSignupBtn.addEventListener('click', () => openAuthModal('signup'));

loginForm.addEventListener('submit', submitLogin);
signupForm.addEventListener('submit', submitSignup);

// Close modal when clicking outside overlay
authModal.addEventListener('click', (e) => {
  if (e.target === authModal) {
    closeAuthModal();
  }
});

// Initialize authentication on page load
updateAuthUI();
renderReportFormSection();

// Configure PDF.js Worker on Startup
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// -------------------------------------------------------------
// V4 Resume Parsing & Skill Matching Handlers
// -------------------------------------------------------------

// Render the Skill Match dashboard section
function renderSkillMatch() {
  if (!appState.resumeFileName) {
    skillMatchPlaceholder.classList.remove('hidden');
    skillMatchDetails.classList.add('hidden');
    return;
  }
  
  skillMatchPlaceholder.classList.add('hidden');
  skillMatchDetails.classList.remove('hidden');
  
  const matched = appState.jobSkills.filter(skill => appState.resumeSkills.includes(skill));
  const gaps = appState.jobSkills.filter(skill => !appState.resumeSkills.includes(skill));
  
  const totalRequired = appState.jobSkills.length;
  // Round to nearest integer as required
  const matchPercent = totalRequired > 0 ? Math.round((matched.length / totalRequired) * 100) : 100;
  
  skillMatchValue.textContent = `${matchPercent}%`;
  
  // Render matched badges
  matchedSkillsBadges.innerHTML = '';
  if (matched.length === 0) {
    matchedSkillsBadges.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">None</span>`;
  } else {
    matched.forEach(skill => {
      const badge = document.createElement('span');
      badge.className = 'skill-badge skill-badge-matched';
      badge.textContent = skill;
      matchedSkillsBadges.appendChild(badge);
    });
  }
  
  // Render gap badges
  gapSkillsBadges.innerHTML = '';
  if (gaps.length === 0) {
    gapSkillsBadges.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No gaps detected!</span>`;
  } else {
    gaps.forEach(skill => {
      const badge = document.createElement('span');
      badge.className = 'skill-badge skill-badge-gap';
      badge.textContent = skill;
      gapSkillsBadges.appendChild(badge);
    });
  }
}

// Parse text content from PDF client-side using PDF.js
async function parsePdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + ' ';
  }
  
  const trimmed = fullText.trim();
  if (trimmed.length === 0) {
    throw new Error("Could not read this PDF. Ensure it has an extractable text layer (scanned or image PDFs are not supported).");
  }
  
  return trimmed;
}

// Handle file uploaded from selector or drop
async function handleResumeUpload(file) {
  // Show loading indicator
  resumeUploadZone.classList.add('hidden');
  resumeStatusCard.classList.remove('hidden');
  resumeFileNameText.textContent = "Parsing resume...";
  resumeSkillsBadge.textContent = "Reading PDF...";
  
  try {
    const text = await parsePdfText(file);
    const skills = extractSkills(text);
    
    appState.resumeFileName = file.name;
    appState.resumeSkills = skills;
    
    // Render status
    resumeFileNameText.textContent = file.name;
    resumeSkillsBadge.textContent = `${skills.length} Skill${skills.length !== 1 ? 's' : ''}`;
    
    // Re-run matching calculations if analysis results are active
    if (!resultsContent.classList.contains('hidden')) {
      renderSkillMatch();
    }
  } catch (err) {
    console.error("Resume parsing error:", err);
    alert(`Resume Error: ${err.message}`);
    clearResume();
  }
}

// Reset/Clear in-memory resume
function clearResume() {
  appState.resumeFileName = "";
  appState.resumeSkills = [];
  
  resumeFileInput.value = '';
  resumeStatusCard.classList.add('hidden');
  resumeUploadZone.classList.remove('hidden');
  
  renderSkillMatch();
}

// Drag & drop listeners
resumeUploadZone.addEventListener('click', () => {
  resumeFileInput.click();
});

resumeFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleResumeUpload(e.target.files[0]);
  }
});

resumeUploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  resumeUploadZone.classList.add('dragover');
});

resumeUploadZone.addEventListener('dragleave', () => {
  resumeUploadZone.classList.remove('dragover');
});

resumeUploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  resumeUploadZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    if (file.type === 'application/pdf') {
      handleResumeUpload(file);
    } else {
      alert("Please upload a PDF file only.");
    }
  }
});

clearResumeBtn.addEventListener('click', clearResume);

// V6 Helper: Update Verified Badge UI dynamically
function updateVerifiedBadge() {
  const verifiedBadge = document.getElementById('verified-badge');
  if (!verifiedBadge) return;

  const urlVal = urlInput.value.trim();
  const eligible = appState.verification?.eligible === true;
  const hasHardBlocks = appState.triggeredFlags.some(flag => flag.tier === 'hard-block');

  if (urlVal && eligible && !hasHardBlocks) {
    if (verifiedBadge.classList.contains('hidden')) {
      verifiedBadge.classList.remove('hidden');
      verifiedBadge.classList.remove('verified-badge-pop');
      void verifiedBadge.offsetWidth; // trigger reflow
      verifiedBadge.classList.add('verified-badge-pop');
    }
  } else {
    verifiedBadge.classList.add('hidden');
    verifiedBadge.classList.remove('verified-badge-pop');
  }
}

