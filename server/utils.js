/**
 * Normalizes an internship source URL to prevent duplication and drift.
 * - Strips query parameters (e.g., ?ref=123)
 * - Strips hash/fragment identifiers (e.g., #details)
 * - Strips trailing slashes (e.g., /foo/ -> /foo)
 * 
 * @param {string} rawUrl The raw URL input
 * @returns {string} The normalized URL
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  
  let trimmed = rawUrl.trim();
  
  try {
    const parsed = new URL(trimmed);
    
    // Normalize protocol, host and pathname
    let normalized = `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}`;
    
    // Strip trailing slash if it is not just the root domain (e.g. "http://example.com" stays)
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  } catch (e) {
    // Fallback split logic if URL is not absolute (e.g., "internshala.com/detail/xyz")
    let normalized = trimmed.split('?')[0].split('#')[0];
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}

/**
 * Extracts the primary domain name from a URL string, stripping subdomains like 'www.'.
 * 
 * @param {string} rawUrl The raw URL input
 * @returns {string|null} The domain name (e.g. "example.com")
 */
export function extractDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  
  let trimmed = rawUrl.trim();
  // Ensure protocol exists for URL parsing
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'http://' + trimmed;
  }
  
  try {
    const parsed = new URL(trimmed);
    let hostname = parsed.hostname.toLowerCase();
    
    // Strip leading "www." if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch (e) {
    // Fallback: extract from split string
    let host = trimmed.split('?')[0].split('#')[0];
    if (host.includes('://')) {
      host = host.split('://')[1];
    }
    host = host.split('/')[0].split(':')[0].toLowerCase();
    
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host || null;
  }
}

/**
 * Parses raw WHOIS query text to extract the domain's creation or registration date.
 * 
 * @param {string} rawText Raw WHOIS output
 * @returns {Date|null} Native Date object or null if not found/invalid
 */
export function parseWhoisDate(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  
  const lines = rawText.split('\n');
  const datePatterns = [
    /creation\s*date\s*:\s*(.+)/i,
    /created\s*on\s*:\s*(.+)/i,
    /created\s*:\s*(.+)/i,
    /registered\s*on\s*:\s*(.+)/i,
    /registration\s*date\s*:\s*(.+)/i,
    /domain\s*registration\s*date\s*:\s*(.+)/i,
    /registered\s*:\s*(.+)/i,
    /creation-date\s*:\s*(.+)/i,
    /creationdate\s*:\s*(.+)/i
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1].split(' ')[0].trim(); // Take date part if it has timezone text
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }
  }
  
  return null;
}
