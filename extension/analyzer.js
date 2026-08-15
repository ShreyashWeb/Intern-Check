import { rules } from './rules.js';

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

// Helper: Escape HTML to avoid injection
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Runs the exact V1 scoring logic on the provided text.
 * @param {string} text The extracted internship page text
 * @returns {object} Analysis result containing score, flags, and counts
 */
export function analyzeText(text) {
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
  
  // Apply soft-signal co-occurrence filter (needs at least 2 distinct soft signals)
  let activeSoftSignals = [];
  if (softSignalMatches.length >= 2) {
    activeSoftSignals = softSignalMatches;
  }
  
  const triggeredFlags = [...hardBlockMatches, ...activeSoftSignals];
  
  let score = 100;
  triggeredFlags.forEach(flag => {
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
    triggeredFlags.push(shortDescRule);
    score -= shortDescRule.deduction;
  }
  
  // Floor/ceil bounds [0, 100]
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    triggeredFlags,
    hardBlocksCount: hardBlockMatches.length,
    softSignalsCount: activeSoftSignals.length
  };
}
