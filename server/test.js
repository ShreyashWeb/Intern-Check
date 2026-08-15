import { pool } from './db.js';
import { normalizeUrl } from './utils.js';

const baseUrl = 'http://localhost:5000';

// Test Data
const testUser = {
  name: 'Test Reporter',
  email: `test_reporter_${Date.now()}@example.com`,
  password: 'SecurePassword123!'
};

const testUser2 = {
  name: 'V6 Helper Tester',
  email: `v6_tester_${Date.now()}@example.com`,
  password: 'Password987!'
};

let userToken = '';
let userToken2 = '';
let testInternshipUrl = `https://example-jobs.com/detail/software-engineer-${Date.now()}?utm_source=test`;
let normalizedUrl = normalizeUrl(testInternshipUrl);

async function runTests() {
  console.log("\n==========================================");
  console.log("RUNNING V6 BACKEND INTEGRATION TESTS");
  console.log("==========================================\n");

  try {
    // -----------------------------------------------------------------
    // Test 1: Signup creates a user row and returns JWT
    // -----------------------------------------------------------------
    console.log("Test 1: POST /auth/signup - Creating user...");
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (signupRes.status !== 201) {
      throw new Error(`Signup failed with status ${signupRes.status}: ${await signupRes.text()}`);
    }

    const signupData = await signupRes.json();
    if (!signupData.token || !signupData.user || signupData.user.name !== testUser.name) {
      throw new Error("Signup response payload is invalid.");
    }
    
    userToken = signupData.token;

    // Register second user for V6 validation checks
    const signup2Res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser2)
    });
    if (signup2Res.status !== 201) {
      throw new Error(`Second signup failed with status ${signup2Res.status}`);
    }
    const signup2Data = await signup2Res.json();
    userToken2 = signup2Data.token;

    console.log("✅ PASS: Signup created user and returned valid JWT token.\n");

    // Let's verify the database row has a hashed password
    const dbUserQuery = await pool.query('SELECT * FROM users WHERE email = $1', [testUser.email]);
    if (dbUserQuery.rowCount === 0) {
      throw new Error("User was not found in the users database table!");
    }
    const dbUser = dbUserQuery.rows[0];
    if (dbUser.password_hash === testUser.password) {
      throw new Error("Security check failed: Password was stored in plain text, not hashed!");
    }
    console.log("✅ PASS: Password successfully hashed in the database.\n");

    // -----------------------------------------------------------------
    // Test 2: Login with wrong password returns 401
    // -----------------------------------------------------------------
    console.log("Test 2: POST /auth/login - Testing login with invalid credentials...");
    const wrongLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'WrongPassword123' })
    });
    
    if (wrongLoginRes.status !== 401) {
      throw new Error(`Expected status 401 but got ${wrongLoginRes.status}`);
    }
    console.log("✅ PASS: Login with wrong credentials rejected with 401.\n");

    // -----------------------------------------------------------------
    // Test 3: Login with correct credentials succeeds
    // -----------------------------------------------------------------
    console.log("Test 3: POST /auth/login - Testing login with correct credentials...");
    const correctLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    if (correctLoginRes.status !== 200) {
      throw new Error(`Expected status 200 but got ${correctLoginRes.status}`);
    }

    const loginData = await correctLoginRes.json();
    if (!loginData.token) {
      throw new Error("Expected token in login payload.");
    }
    console.log("✅ PASS: Login with correct credentials succeeded with 200.\n");

    // -----------------------------------------------------------------
    // Test 4: Report submission without token returns 401
    // -----------------------------------------------------------------
    console.log("Test 4: POST /reports - Testing report submission without authorization token...");
    const unauthReportRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Unauth Co',
        title: 'Developer',
        reason: 'Financial Requirement',
        description: 'Demanded fee.'
      })
    });

    if (unauthReportRes.status !== 401) {
      throw new Error(`Expected status 401 but got ${unauthReportRes.status}`);
    }
    console.log("✅ PASS: Unauthorized report submission correctly rejected with 401.\n");

    // -----------------------------------------------------------------
    // Test 5: Report submission with token succeeds
    // -----------------------------------------------------------------
    console.log("Test 5: POST /reports - Testing authorized report submission...");
    const authReportRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Financial Requirement',
        description: 'Requires a payment of 500 Rs for safety registration.',
        report_type: 'concern'
      })
    });

    if (authReportRes.status !== 201) {
      throw new Error(`Expected status 201 but got ${authReportRes.status}: ${await authReportRes.text()}`);
    }

    const reportData = await authReportRes.json();
    if (!reportData.report || reportData.report.reason !== 'Financial Requirement') {
      throw new Error("Report creation returned an invalid payload.");
    }
    console.log("✅ PASS: Report submitted successfully.\n");

    // -----------------------------------------------------------------
    // Test 6: URL Normalization matches correctly
    // -----------------------------------------------------------------
    console.log("Test 6: GET /reports - Verifying URL normalization matching...");
    
    // We submit a second report on the same URL but with a trailing slash to test matching
    const testInternshipUrlWithSlash = `${testInternshipUrl}/`;
    
    const secondReportRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken2}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrlWithSlash,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Communication',
        description: 'Told me to join a WhatsApp group in the email.',
        report_type: 'concern'
      })
    });

    if (secondReportRes.status !== 201) {
      throw new Error("Failed to submit second report.");
    }

    // Now query with query parameters (which should be stripped during query normalization)
    const queryUrl = `${normalizedUrl}?some_param=abc&ref=xyz`;
    console.log(`Querying reports with URL parameter: ${queryUrl}`);
    
    const fetchRes = await fetch(`${baseUrl}/reports?url=${encodeURIComponent(queryUrl)}`);
    if (fetchRes.status !== 200) {
      throw new Error(`Expected status 200 but got ${fetchRes.status}`);
    }

    const fetchedData = await fetchRes.json();
    
    if (fetchedData.summary.total !== 2) {
      throw new Error(`Expected 2 reports matching normalized URL, but got: ${fetchedData.summary.total}`);
    }

    if (fetchedData.summary.categories['Financial Requirement'] !== 1 || fetchedData.summary.categories['Communication'] !== 1) {
      throw new Error("Report categories summary is incorrect.");
    }

    console.log("✅ PASS: URL Normalization matched and normalized URLs across endpoints successfully.\n");

    // -----------------------------------------------------------------
    // Test 7: Rate Limiting operates
    // -----------------------------------------------------------------
    console.log("Test 7: Rate Limiting - Making rapid requests to trigger 429...");
    let triggeredRateLimit = false;

    // We make 15 requests with x-test-suite header to hit the limit of 10
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/reports?url=${encodeURIComponent(testInternshipUrl)}`, {
        headers: { 'X-Test-Suite': 'true' }
      });
      if (res.status === 429) {
        triggeredRateLimit = true;
        break;
      }
    }

    if (!triggeredRateLimit) {
      throw new Error("Expected to trigger 429 Too Many Requests, but all queries succeeded.");
    }
    console.log("✅ PASS: Rate limiter successfully blocked spam requests with 429.\n");

    // Reset rate limit for the rest of the integration tests
    console.log("Resetting rate limit cache...");
    const resetLimitRes = await fetch(`${baseUrl}/reset-rate-limit`, { method: 'POST' });
    if (resetLimitRes.status !== 200) {
      throw new Error(`Expected status 200 for reset-rate-limit but got ${resetLimitRes.status}`);
    }
    console.log("✅ PASS: Rate limit successfully reset.\n");

    // -----------------------------------------------------------------
    // Test 8: Domain Age Verification & Caching (V5)
    // -----------------------------------------------------------------
    console.log("Test 8: Domain Age Verification - Fetching age for google.com...");
    const domainUrl = "https://google.com/search?q=internships";
    
    // We clean up any pre-existing cache for google.com first
    await pool.query("DELETE FROM domains WHERE domain = 'google.com'");

    const verifyRes1 = await fetch(`${baseUrl}/verify-domain?url=${encodeURIComponent(domainUrl)}`);
    if (verifyRes1.status !== 200) {
      throw new Error(`Expected status 200 but got ${verifyRes1.status}`);
    }

    const verifyData1 = await verifyRes1.json();
    if (verifyData1.domain !== "google.com") {
      throw new Error(`Expected domain 'google.com' but got '${verifyData1.domain}'`);
    }
    if (typeof verifyData1.age_days !== "number" || verifyData1.age_days < 5000) {
      throw new Error(`Expected a high registration age in days for google.com, got: ${verifyData1.age_days}`);
    }
    if (verifyData1.cached !== false) {
      throw new Error("Expected first request to NOT be cached.");
    }

    console.log("✅ PASS: Successfully queried WHOIS and parsed domain age.");

    // Query again to check caching
    console.log("Querying google.com again to check cache...");
    const verifyRes2 = await fetch(`${baseUrl}/verify-domain?url=${encodeURIComponent(domainUrl)}`);
    if (verifyRes2.status !== 200) {
      throw new Error(`Expected status 200 but got ${verifyRes2.status}`);
    }

    const verifyData2 = await verifyRes2.json();
    if (verifyData2.cached !== true) {
      throw new Error("Expected second request to be cached.");
    }
    if (verifyData2.age_days !== verifyData1.age_days) {
      throw new Error(`Expected cached age to be equal (${verifyData1.age_days}), got ${verifyData2.age_days}`);
    }
    console.log("✅ PASS: Domain age cached correctly in domains table.");

    // Test lookup on nonexistent domain returns null age_days
    console.log("Testing verify-domain on nonexistent domain...");
    const invalidDomainUrl = "https://this-does-not-exist-1786.xyz/job";
    const verifyRes3 = await fetch(`${baseUrl}/verify-domain?url=${encodeURIComponent(invalidDomainUrl)}`);
    
    if (verifyRes3.status !== 200) {
      throw new Error(`Expected status 200 for invalid domain lookup but got ${verifyRes3.status}`);
    }
    const verifyData3 = await verifyRes3.json();
    if (verifyData3.age_days !== null) {
      throw new Error(`Expected null age_days for nonexistent domain, got: ${verifyData3.age_days}`);
    }
    console.log("✅ PASS: Invalid domain handles raw WHOIS failures gracefully (returns null age_days).\n");

    // -----------------------------------------------------------------
    // Test 9: Verified Badge System & Self-Stuffing Protection (V6)
    // -----------------------------------------------------------------
    console.log("Test 9: Verified Badge System & Self-Stuffing Protection...");

    // 1. Submit report with missing report_type
    console.log("Submitting report with missing report_type...");
    const badRes1 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Financial',
        description: 'Missing report type.'
      })
    });
    if (badRes1.status !== 400) {
      throw new Error(`Expected status 400 for missing report_type, got: ${badRes1.status}`);
    }
    console.log("✅ PASS: Correctly rejected missing report_type.");

    // 2. Submit report with invalid report_type
    console.log("Submitting report with invalid report_type...");
    const badRes2 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Financial',
        description: 'Invalid report type.',
        report_type: 'suspicious'
      })
    });
    if (badRes2.status !== 400) {
      throw new Error(`Expected status 400 for invalid report_type, got: ${badRes2.status}`);
    }
    console.log("✅ PASS: Correctly rejected invalid report_type.");

    // 3. Submit first positive report as User 1
    console.log("Submitting first positive report as User 1...");
    const goodRes1 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Legitimate',
        description: 'Great hiring process.',
        report_type: 'positive'
      })
    });
    if (goodRes1.status !== 201) {
      throw new Error(`Expected status 201, got: ${goodRes1.status}`);
    }
    console.log("✅ PASS: Positive report submitted successfully.");

    // 4. Submit a second positive report as User 1 (should trigger UPSERT)
    console.log("Submitting a second positive report as the same user to verify upsert...");
    const goodRes2 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Legitimate',
        description: 'Updated report description.',
        report_type: 'positive'
      })
    });
    if (goodRes2.status !== 201) {
      throw new Error(`Expected status 201 for upsert, got: ${goodRes2.status}`);
    }
    console.log("✅ PASS: Upsert report replacement executed successfully.");

    // 5. Query and verify positive report count remains 1 (prevent self-stuffing)
    const checkRes1 = await fetch(`${baseUrl}/reports?url=${encodeURIComponent(testInternshipUrl)}`);
    const checkData1 = await checkRes1.json();
    if (checkData1.summary.positive !== 1) {
      throw new Error(`Expected positive count to be 1, got: ${checkData1.summary.positive}`);
    }
    if (checkData1.verification.eligible !== false) {
      throw new Error("Expected eligibility to be false (only 1 positive report).");
    }
    console.log("✅ PASS: Self-stuffing prevented. Only 1 positive report counted.");

    // 6. Submit a second positive report as User 2
    console.log("Submitting positive report as User 2...");
    const goodRes3 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken2}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Legitimate',
        description: 'Confirmed legitimate.',
        report_type: 'positive'
      })
    });
    if (goodRes3.status !== 201) {
      throw new Error(`Expected status 201, got: ${goodRes3.status}`);
    }

    // 7. Insert fake google.com domain age >= 180 in table to check verification eligibility
    await pool.query(
      `INSERT INTO domains (domain, age_days, checked_at) 
       VALUES ('example-jobs.com', 200, NOW()) 
       ON CONFLICT (domain) 
       DO UPDATE SET age_days = EXCLUDED.age_days, checked_at = EXCLUDED.checked_at`
    );

    // 8. Query and verify listing is now VERIFIED eligible
    const checkRes2 = await fetch(`${baseUrl}/reports?url=${encodeURIComponent(testInternshipUrl)}`);
    const checkData2 = await checkRes2.json();
    if (checkData2.summary.positive !== 2) {
      throw new Error(`Expected positive count to be 2, got: ${checkData2.summary.positive}`);
    }
    if (checkData2.verification.eligible !== true) {
      throw new Error(`Expected eligibility to be true, got false. Reason: ${checkData2.verification.reason}`);
    }
    console.log("✅ PASS: Verification succeeded with 2 distinct positive reports + mature domain.");

    // 9. Update User 2's report to 'concern'
    console.log("Updating User 2's report to concern...");
    const goodRes4 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken2}`
      },
      body: JSON.stringify({
        source_url: testInternshipUrl,
        company_name: 'Apex Test Corp',
        title: 'V6 QA Engineer',
        reason: 'Financial',
        description: 'Wait, they asked for a fee later!',
        report_type: 'concern'
      })
    });
    if (goodRes4.status !== 201) {
      throw new Error(`Expected status 201, got: ${goodRes4.status}`);
    }

    // 10. Query and verify listing is disqualified due to concern reports
    const checkRes3 = await fetch(`${baseUrl}/reports?url=${encodeURIComponent(testInternshipUrl)}`);
    const checkData3 = await checkRes3.json();
    if (checkData3.summary.positive !== 1 || checkData3.summary.concern !== 1) {
      throw new Error(`Expected 1 positive and 1 concern, got: pos=${checkData3.summary.positive}, con=${checkData3.summary.concern}`);
    }
    if (checkData3.verification.eligible !== false) {
      throw new Error("Expected eligibility to be false due to active concerns.");
    }
    console.log("✅ PASS: Listing successfully disqualified when concern report is submitted.\n");

    // -----------------------------------------------------------------
    // Database Cleanup
    // -----------------------------------------------------------------
    console.log("Cleaning up test records from database...");
    
    // Cascading deletes will handle reports
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [testUser.email, testUser2.email]);
    await pool.query('DELETE FROM internships WHERE source_url = $1', [normalizedUrl]);
    await pool.query("DELETE FROM domains WHERE domain IN ('google.com', 'this-does-not-exist-1786.xyz', 'example-jobs.com')");
    
    console.log("✅ Database test records cleaned up successfully.");
    console.log("\n==========================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("==========================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err.message);
    
    // Clean up anyway
    try {
      await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [testUser.email, 'v6_tester@example.com']);
      await pool.query('DELETE FROM internships WHERE source_url = $1', [normalizedUrl]);
      await pool.query("DELETE FROM domains WHERE domain IN ('google.com', 'this-does-not-exist-1786.xyz', 'example-jobs.com')");
    } catch (_) {}
    
    process.exit(1);
  }
}

// Introduce a small delay to ensure the database server and migrations are initialized
setTimeout(runTests, 1000);
