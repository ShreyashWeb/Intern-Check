# InternCheck — Expanded Project Plan

> Know what you're applying for.

This builds on the original MVP → Extension → Community → Personalization roadmap, adding features and infrastructure that raise both the product quality and the technical depth of the project.

---

## 1. Trust & Verification Layer (the credibility multiplier)

The single biggest lever for making the "Reality Score" defensible is layering in **independently checkable facts**, not just NLP judgment.

- **Company existence check** — cross-reference company name against MCA (Ministry of Corporate Affairs) registration data, GST number lookup, or LinkedIn company page presence. A listing with zero corporate footprint is a strong, objective signal — no AI needed.
- **Domain age & WHOIS check** — freshly registered domains (< 90 days) hosting "hiring now" pages are a classic scam pattern. Cheap to check, very high signal.
- **LinkedIn presence cross-check** — does the company have employees listed, an active page, recent posts? A "company" with a website but no LinkedIn footprint is worth flagging.
- **Verified Company Badge** — once a company passes checks or accumulates enough positive community reports, show a green "Verified" badge. Gives companies incentive to cooperate rather than dispute your platform.
- **Dispute/appeal flow** — a company (or student) can contest a red flag or score with evidence. Routes to a moderation queue. This matters a lot if you ever want real companies to take the platform seriously instead of treating it as adversarial.

## 2. Smarter Red Flag Detection

Extend beyond keyword rules toward a layered detection system:

- **Tiered detection engine**:
  1. **Hard rules** (regex/keyword) — "registration fee", "pay to confirm", "guaranteed placement" → instant flag, no LLM cost.
  2. **Statistical/heuristic checks** — salary far outside market range for the role+location (needs a salary benchmark dataset), unusually short/generic description length, duration mismatched with stated learning outcomes.
  3. **LLM judgment** — only for ambiguous cases the first two tiers can't resolve (e.g., "is this description suspiciously vague for a technical role").
- **Salary benchmark database** — scrape/aggregate real stipend data per role + city + experience level (this alone is a great secondary dataset and makes "unrealistic salary" claims falsifiable rather than vibes-based).
- **Pattern clustering across listings** — if the same phrasing, same "company," or same application URL shows up across many flagged listings, auto-raise suspicion (classic content-farm/internship-mill detection).
- **Trend view per company** — "Red flags reported for this company have increased 40% in the last 3 months" — turns static scores into a living signal.

## 3. Community & Social Features

- **Reviewer reputation system** — reports from users with a track record of accurate, evidence-backed reports carry more weight than a brand-new anonymous account. Prevents review-bombing and fake positive reviews.
- **Evidence attachments** — screenshots, offer letters, chat logs attached to a report (stored securely, moderated before public display).
- **Upvote/downvote on reports** — community can surface the most credible reports.
- **"Similar internships" recommendations** — using embeddings, suggest better-scored alternatives when a listing scores low ("This scored 41/100 — here are 3 similar roles that scored 80+").
- **Alumni/senior verification** — let verified students from the same college confirm or dispute a listing, which colleges and career cells would find especially credible.

## 4. Personalization & Utility Features

- **Skill-match scoring** (from your original v4) — extend with a **skill gap report**: "You're missing: Docker, CI/CD basics" plus links to free resources.
- **Application tracker** — let students save internships they've checked, track application status, get notified if the score changes (e.g., new red flags reported after they applied).
- **Resume parser** — auto-extract skills from an uploaded resume instead of manual entry, feeding directly into the match score.
- **Comparison view** — side-by-side comparison of 2–3 internships (score, red flags, skill match, compensation).
- **"Explain like I'm new to this" mode** — plain-language explanations of why something is a red flag, aimed at first-time job seekers who won't recognize scam patterns yet.

## 5. Chrome Extension — Add-ons

- **Site-specific parsers** for major Indian job/internship boards (Internshala, LinkedIn, Naukri, Indeed) rather than generic scraping — much higher extraction accuracy.
- **Inline badge injection** — overlay a small Reality Score badge directly on listing pages as the student scrolls a search results page, not just on click.
- **One-click report** — "Something feels off" button that pre-fills a report from the current page.
- **Save for later** — bookmark listings into the account without leaving the page.

## 6. B2B / Institutional Angle (strong differentiator for a portfolio project)

- **Career Cell Dashboard** — colleges could bulk-upload/verify internship postings for their students, and see aggregate red-flag trends across what students are applying to.
- **Bulk analysis API** — placement cells paste a list of 50 URLs, get a batch report.
- **Public company transparency pages** — a shareable page per company showing its aggregate score history (useful both as a deterrent to bad actors and as a growth/SEO loop).

## 7. Technical & Infrastructure Add-ons

- **Caching layer** (Redis) — cache scores per URL/company for a TTL so repeat lookups don't re-burn LLM calls.
- **Background job queue** (BullMQ or similar) — scraping, LLM analysis, and salary-benchmark lookups run async, not blocking the request.
- **Vector DB** (pgvector or a dedicated store) — embeddings for "similar internship" search and company de-duplication (catching the same scam posted under slightly different company names).
- **Rate limiting + CAPTCHA** on report submission — prevents spam/fake report floods.
- **Audit trail** — every score, every moderation decision, every dispute resolution logged immutably. Matters a lot if this becomes a real, publicly-used product.
- **Feedback loop for the AI layer** — periodically fine-tune or prompt-tune your red-flag classifier using confirmed community reports as labeled data — a genuinely good "AI system that improves from real-world feedback" story for a portfolio.

## 8. Compliance & Safety

- **Clear legal disclaimer** — scores are informational, not legal/financial advice; avoid outright "fraud" labeling (as noted in the original plan) to avoid defamation risk.
- **Data privacy** — resumes, uploaded evidence, and personal reports need clear retention/deletion policies (important if you ever handle Indian users' data — DPDP Act considerations).
- **Moderation before public display** — reports and evidence should pass a moderation queue before appearing publicly, to prevent defamatory or false claims going live instantly.

## 9. Monetization Paths (optional, but strengthens the "product thinking" story)

- **Freemium** — basic score free, detailed breakdown / skill-gap report / application tracker behind a light paywall or account creation.
- **Institutional licensing** — sell the Career Cell Dashboard to colleges.
- **API access** — other platforms (job boards, EdTech apps) pay to embed your Reality Score via API or a "Verified by InternCheck" widget.

## 10. Updated Roadmap

| Version | Focus |
|---|---|
| **V1 (MVP)** | Paste → score → explain, hard-rule red flags only |
| **V2** | Chrome extension, site-specific parsers |
| **V3** | Community reports + reviewer reputation |
| **V4** | Skill-match personalization + resume parsing |
| **V5** | Company verification layer (MCA/WHOIS/LinkedIn checks) + verified badges |
| **V6** | Career Cell dashboard, bulk API, public company pages |
| **V7** | Feedback-loop model tuning, salary benchmark dataset, trend analytics |

---

### Why this version is stronger

The original plan already avoided the trap of "AI decides everything." This version pushes further: it gives you **three independent evidence layers** (hard facts like company registration/domain age, community-verified reports, and AI judgment only where it's genuinely needed) — which is the actual hard problem in trust & safety products, and a much better story to tell in interviews than "I called an LLM API."
