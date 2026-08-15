import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const whois = require('whois');

import { initDb, pool } from './db.js';
import { normalizeUrl, extractDomain, parseWhoisDate } from './utils.js';
import { authMiddleware } from './authMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so our Vite frontend (port 5173) can query this server (port 5000)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or extension background scripts)
    if (!origin) return callback(null, true);
    
    // Allow allowedOrigin, local development URL, and Chrome Extension popups/contents
    if (origin === allowedOrigin || origin === 'http://localhost:5173' || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Initialize Database Tables
initDb().catch(err => {
  console.error("Critical database startup error:", err.message);
});

// Configure Rate Limiting: Max 100 requests per 15 minutes for normal users, 10 for test suite
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    if (req.headers['x-test-suite'] === 'true') {
      return 10;
    }
    return 100;
  },
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to sensitive endpoints
app.use('/auth/signup', requestLimiter);
app.use('/auth/login', requestLimiter);
app.use('/reports', requestLimiter);

// Test-only endpoint to reset the rate limit for integration testing (gated in production)
if (process.env.NODE_ENV !== 'production') {
  app.post('/reset-rate-limit', (req, res) => {
    if (requestLimiter && typeof requestLimiter.resetKey === 'function') {
      requestLimiter.resetKey(req.ip);
      // Reset for localhost IPv4 & IPv6 variants specifically to be safe in testing
      requestLimiter.resetKey('::1');
      requestLimiter.resetKey('127.0.0.1');
      requestLimiter.resetKey('::ffff:127.0.0.1');
    }
    return res.json({ message: 'Rate limit reset successfully.' });
  });
}

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    // Check if user already exists
    const userCheck = await pool.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userCheck.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash password using bcrypt (10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const insertRes = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const user = insertRes.rows[0];

    // Issue JWT token
    const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_key';
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Signup successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error("Signup error:", err.message);
    return res.status(500).json({ error: 'Server error during signup.' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Retrieve user details
    const selectRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (selectRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = selectRes.rows[0];

    // Compare passwords using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Issue JWT token
    const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_key';
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// -------------------------------------------------------------
// Reports Routes
// -------------------------------------------------------------

// GET /reports?url=...
app.get('/reports', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required.' });
  }

  const normalizedUrl = normalizeUrl(url);
  const domain = extractDomain(normalizedUrl);

  try {
    // 1. Find the internship by normalized url
    const internshipRes = await pool.query('SELECT * FROM internships WHERE source_url = $1', [normalizedUrl]);
    
    if (internshipRes.rowCount === 0) {
      return res.json({
        internship: null,
        reports: [],
        summary: { total: 0, positive: 0, concern: 0, categories: {} },
        verification: {
          eligible: false,
          reason: "Requires at least 2 positive reports (currently 0)"
        }
      });
    }

    const internship = internshipRes.rows[0];

    // 2. Fetch all visible reports linked to this internship
    const reportsRes = await pool.query(
      `SELECT r.id, r.reason, r.description, r.created_at, r.report_type, u.name as user_name 
       FROM reports r 
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.internship_id = $1 AND r.status = 'visible' 
       ORDER BY r.created_at DESC`,
      [internship.id]
    );

    // 3. Compile report summaries/counts grouped by category/reason
    const summaryRes = await pool.query(
      `SELECT reason, COUNT(*) as count 
       FROM reports 
       WHERE internship_id = $1 AND status = 'visible' 
       GROUP BY reason`,
      [internship.id]
    );

    const categories = {};
    summaryRes.rows.forEach(row => {
      categories[row.reason] = parseInt(row.count, 10);
    });

    // 4. Fetch the domain age for V6 verification checks
    const domainCheck = await pool.query('SELECT age_days FROM domains WHERE domain = $1', [domain]);
    const domainAge = domainCheck.rowCount > 0 ? domainCheck.rows[0].age_days : null;

    // 5. Compute verification details
    const positiveCount = reportsRes.rows.filter(r => r.report_type === 'positive').length;
    const concernCount = reportsRes.rows.filter(r => r.report_type === 'concern').length;

    let eligible = false;
    let reason = "Eligible";

    if (domainAge === null) {
      reason = "Domain age data is unavailable";
    } else if (domainAge < 180) {
      reason = `Domain age is too young (${domainAge} days < 180 days)`;
    } else if (concernCount > 0) {
      reason = `Listing has active concern reports (${concernCount})`;
    } else if (positiveCount < 2) {
      reason = `Requires at least 2 positive reports (currently ${positiveCount})`;
    } else {
      eligible = true;
    }

    return res.json({
      internship: {
        id: internship.id,
        source_url: internship.source_url,
        company_name: internship.company_name,
        title: internship.title
      },
      reports: reportsRes.rows,
      summary: {
        total: reportsRes.rowCount,
        positive: positiveCount,
        concern: concernCount,
        categories
      },
      verification: {
        eligible,
        reason
      }
    });

  } catch (err) {
    console.error("Get reports error:", err.message);
    return res.status(500).json({ error: 'Server error retrieving reports.' });
  }
});

// POST /reports (requires valid JWT token)
app.post('/reports', authMiddleware, async (req, res) => {
  const { source_url, company_name, title, reason, description, report_type } = req.body;
  const userId = req.user.userId;

  if (!source_url || !company_name || !title || !reason || !description || !report_type) {
    return res.status(400).json({ error: 'All fields (source_url, company_name, title, reason, description, report_type) are required.' });
  }

  const normalizedType = report_type.trim().toLowerCase();
  if (normalizedType !== 'positive' && normalizedType !== 'concern') {
    return res.status(400).json({ error: "report_type must be either 'positive' or 'concern'." });
  }

  const normalizedUrl = normalizeUrl(source_url);

  try {
    // 1. Find or create internship entry (using transaction or INSERT ON CONFLICT)
    const internshipInsert = await pool.query(
      `INSERT INTO internships (source_url, company_name, title) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (source_url) 
       DO UPDATE SET company_name = EXCLUDED.company_name, title = EXCLUDED.title 
       RETURNING id`,
      [normalizedUrl, company_name.trim(), title.trim()]
    );
    
    const internshipId = internshipInsert.rows[0].id;

    // 2. Upsert report linked to the user on this internship URL
    const reportInsert = await pool.query(
      `INSERT INTO reports (internship_id, user_id, reason, description, report_type) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (internship_id, user_id) 
       DO UPDATE SET 
         reason = EXCLUDED.reason, 
         description = EXCLUDED.description, 
         report_type = EXCLUDED.report_type,
         status = 'visible',
         created_at = NOW()
       RETURNING id, internship_id, user_id, reason, description, status, created_at, report_type`,
      [internshipId, userId, reason.trim(), description.trim(), normalizedType]
    );

    return res.status(201).json({
      message: 'Report submitted successfully.',
      report: reportInsert.rows[0]
    });

  } catch (err) {
    console.error("Submit report error:", err.message);
    return res.status(500).json({ error: 'Server error during report submission.' });
  }
});

// Promise wrapper for whois.lookup
function lookupWhois(domain) {
  return new Promise((resolve, reject) => {
    // Configurable timeout defaulting to 10 seconds to handle cloud network latency
    const timeoutMs = parseInt(process.env.WHOIS_TIMEOUT, 10) || 10000;
    const timeout = setTimeout(() => {
      reject(new Error("WHOIS lookup timed out"));
    }, timeoutMs);
    
    whois.lookup(domain, (err, data) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// GET /verify-domain?url=...
app.get('/verify-domain', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  const domain = extractDomain(url);
  if (!domain) {
    return res.status(400).json({ error: 'Invalid URL or hostname could not be extracted.' });
  }

  try {
    // 1. Query the cache (domains table) by exact match
    const cacheCheck = await pool.query(
      `SELECT age_days, checked_at FROM domains WHERE domain = $1`,
      [domain]
    );

    if (cacheCheck.rowCount > 0) {
      const cached = cacheCheck.rows[0];
      const ageMs = Date.now() - new Date(cached.checked_at).getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      if (ageMs < thirtyDaysMs) {
        // Return cached registration age
        return res.json({
          domain,
          age_days: cached.age_days,
          cached: true
        });
      }
    }

    // 2. Not cached or cache expired: perform WHOIS lookup
    let rawWhois = '';
    let ageDays = null;

    try {
      rawWhois = await lookupWhois(domain);
      const creationDate = parseWhoisDate(rawWhois);
      if (creationDate) {
        const diffMs = Date.now() - creationDate.getTime();
        ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    } catch (whoisErr) {
      console.warn(`[WHOIS Warning] Lookup failed for domain "${domain}":`, whoisErr.message);
      // Let it fall back to null ageDays (will be stored as null in DB too)
    }

    // 3. Cache the computed result in the domains table
    await pool.query(
      `INSERT INTO domains (domain, age_days, checked_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (domain) 
       DO UPDATE SET age_days = EXCLUDED.age_days, checked_at = EXCLUDED.checked_at`,
      [domain, ageDays]
    );

    return res.json({
      domain,
      age_days: ageDays,
      cached: false
    });

  } catch (err) {
    console.error("verify-domain endpoint error:", err.message);
    return res.status(500).json({ error: 'Server error during domain verification.' });
  }
});


// Server Initialization
app.listen(PORT, () => {
  console.log(`[Server] InternCheck server running on port ${PORT}`);
});
