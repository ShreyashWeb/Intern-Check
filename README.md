# InternCheck

> Know what you're applying for.

InternCheck helps students figure out whether an internship listing is legitimate before they apply. Paste a description (or scan a live listing with the Chrome extension) and get a Reality Score, an explained breakdown of red flags, a domain-age trust signal, community-reported experiences, a resume-based skill match — and, when the evidence lines up, a Verified badge.

## The problem

Internship and "work from home" scams are widespread and hard to spot for someone applying for their first job — vague descriptions, upfront fees disguised as "registration" or "training," and WhatsApp/Telegram-only recruitment are all common patterns that aren't obvious to a first-time applicant. InternCheck makes those patterns visible and explainable instead of asking students to just "trust their gut."

## What it does
- **Reality Score (0–100)** — scored using an explainable hard-rules engine, not a black-box AI guess. Every deduction ties to a specific, visible pattern in the text.
- **Tiered red flag detection** — hard-block indicators (upfront fees, security deposits, "pay to confirm" placement) deduct on a single match. Soft-signal indicators (unpaid work, WhatsApp/Telegram-only recruitment, MLM/referral language, a freshly registered domain) only count when at least two co-occur — a single ambiguous signal alone isn't enough evidence, since these also show up in plenty of legitimate postings.
- **Chrome extension** — scans the actual page you're viewing on real job boards (Internshala, LinkedIn) using content-targeted extraction, avoiding navbar/footer/boilerplate false positives.
- **Domain age verification** — a live WHOIS lookup checks how long the listing's domain has existed, cached to avoid repeated queries, and feeds into the scoring engine as one more piece of independently-checkable evidence.
- **Community reports** — logged-in students report their real experience (positive or concern) against a listing, matched via a normalized URL so tracking parameters don't fragment the same internship into separate threads. One report per user per listing, so no one can stuff their own review count.
- **Resume-based skill match** — upload a resume (PDF, parsed entirely client-side — the file never leaves your browser) and see a Skill Match percentage plus a Skill Gap list against the internship's stated requirements.
- **Verified Badge** — awarded only when multiple independent trust signals agree: an established domain, at least two distinct positive community reports, zero concern reports, and zero hard-block flags in the current scan. Any one of those failing suppresses the badge — the system is intentionally conservative, since one credible concern should outweigh several positive reports.

## Tech stack
- **Frontend:** Vite + vanilla HTML/CSS/JS, pdf.js for client-side resume parsing
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt password hashing, rate-limited auth/report endpoints
- **External data:** live WHOIS domain lookups (cached)
- **Browser extension:** Chrome Extension, Manifest V3

## Architecture

Two clients, one shared scoring engine, one backend:

- Chrome Extension and Web Frontend (Vite/vanilla JS) both extract listing text and run it through the same client-side scoring engine (rules.js / analyzer.js) — no divergence between how the extension and the web app score a listing.
- The web app additionally talks to the Express backend, which handles everything that needs to be shared across users or looked up live:
  - PostgreSQL — stores users, internships, reports, and domains
  - Live WHOIS lookups — queried on cache-miss, cached in the domains table for 30 days
- The backend exposes REST endpoints for auth, community reports, and domain verification; the Verified Badge is computed on read by combining backend report/domain data with the frontend's current-scan hard-block result — never stored as a static flag that could go stale.

## Running it locally

### 1. Frontend

```bash
npm install
npm run dev
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env   # then fill in your own values
npm run dev
```

### 3. Database

Requires a local PostgreSQL instance. Create a database named `interncheck`; the backend initializes the schema automatically on first run.

### 4. Chrome Extension

Go to chrome://extensions, enable Developer mode, click "Load unpacked," and select the `/extension` folder.

## Roadmap
- [x] **V1** — Core scoring engine (hard-rules, tiered severity, explainable output)
- [x] **V2** — Chrome extension with smart content extraction
- [x] **V3** — User accounts + community reports with URL normalization
- [x] **V4** — Client-side resume parsing + skill-match scoring
- [x] **V5** — Live domain-age verification (WHOIS), integrated as a soft signal
- [x] **V6** — Verified Badge system combining domain trust, report history, and scan results
- [ ] **V7 (future)** — Reviewer reputation weighting to further harden the community layer
- [ ] **V8 (future)** — Company-level identity resolution (aggregate badge/reports across a company's listings, not just one URL)

## Notes on design decisions
- **Scores are built from explainable rules first, AI second** — every red flag ties to a specific, visible piece of evidence in the listing text, deliberately avoiding "the AI thinks this is suspicious" as an unfalsifiable justification.
- **The Verified Badge is per-listing, not per-company** — company name matching ("Acme Tech" vs "Acme Technologies Pvt Ltd") requires real identity resolution that hasn't been built yet. A per-listing badge that's 100% reliable was chosen over a per-company badge that could be subtly inconsistent.
- **Community reports use an upsert-on-duplicate pattern** (one report per user per listing) specifically to prevent a single account from manufacturing a Verified badge by submitting many positive reports.
- **JWT is currently stored in localStorage** for simplicity at this stage; this is a known tradeoff (vulnerable to XSS) rather than an oversight, and would move to an `httpOnly` cookie before any production deployment.
- **A test-only /reset-rate-limit endpoint exists in the backend** to support the automated test suite — this must be removed or gated behind an environment check before any public deployment, since it currently bypasses spam protection with no auth.
