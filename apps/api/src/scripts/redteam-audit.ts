/**
 * RED TEAM PENETRATION TESTING & SECURITY AUDIT TOOL
 * Automatically launches simulated attacks against Magora API endpoints
 * to verify that Blue Team WAF, IPS, sanitization, and access controls
 * deflect, block, and log every hostile vector.
 */

interface AuditResult {
  category: string;
  testName: string;
  payload: string;
  status: "PASSED" | "FAILED";
  httpCode: number;
  expectedDefended: boolean;
  notes: string;
}

const API_BASE = process.env.API_URL || "http://localhost:4000";

async function runRedTeamAudit() {
  console.log("====================================================================");
  console.log("🛡️  MAGORA RED TEAM PENETRATION TEST & CYBER SECURITY AUDIT");
  console.log(`🎯 Target API: ${API_BASE}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log("====================================================================\n");

  const results: AuditResult[] = [];

  // Helper function to send requests
  async function testVector(
    category: string,
    testName: string,
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      expectBlocked?: boolean;
    } = {},
  ): Promise<AuditResult> {
    const method = options.method || "GET";
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const expectBlocked = options.expectBlocked ?? true;

    try {
      const res = await fetch(`${API_BASE}${url}`, { method, headers, body });
      const status = res.status;
      const json = await res.json().catch(() => null);

      let passed = false;
      let notes = "";

      if (expectBlocked) {
        // Attack should be blocked with 403 (WAF), 401 (Auth), or 400 (Validation)
        if (status === 403 || status === 401 || (status === 400 && json?.error?.code === "validation_error")) {
          passed = true;
          notes = `Successfully blocked with HTTP ${status} (${json?.error?.code || "rejected"})`;
        } else {
          passed = false;
          notes = `DANGER: Attack was NOT blocked! Returned HTTP ${status}`;
        }
      } else {
        // Benign test (e.g. Health check or headers)
        if (status >= 200 && status < 400) {
          passed = true;
          notes = `Normal traffic allowed (HTTP ${status})`;
        } else {
          passed = false;
          notes = `Unexpected error (HTTP ${status})`;
        }
      }

      const item: AuditResult = {
        category,
        testName,
        payload: options.body ? JSON.stringify(options.body) : url,
        status: passed ? "PASSED" : "FAILED",
        httpCode: status,
        expectedDefended: expectBlocked,
        notes,
      };
      results.push(item);
      return item;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const item: AuditResult = {
        category,
        testName,
        payload: url,
        status: "FAILED",
        httpCode: 0,
        expectedDefended: expectBlocked,
        notes: `Connection error: ${errorMsg}. Is the server running?`,
      };
      results.push(item);
      return item;
    }
  }

  /* ──────────────────────────────────────────────────────────
   * SUITE 1: SQL Injection (SQLi)
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [1/6] Running SQL Injection (SQLi) Attack Suite...");
  await testVector("SQLi", "Tautology Query Bypass (' OR '1'='1)", "/api/v1/products?q=%27%20OR%20%271%27=%271");
  await testVector("SQLi", "Stacked Query Drop Table (; DROP TABLE users;)", "/api/v1/products?q=%3B%20DROP%20TABLE%20users%3B");
  await testVector("SQLi", "UNION SELECT Extraction", "/api/v1/products?q=union+select+null,password,email+from+users");
  await testVector("SQLi", "Time-based Blind Injection (sleep)", "/api/v1/products?category=cases%27%20AND%20sleep(5)--");
  await testVector("SQLi", "SQL Comment Truncation (admin'--)", "/api/v1/products?q=admin%27--");

  /* ──────────────────────────────────────────────────────────
   * SUITE 2: Cross-Site Scripting (XSS)
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [2/6] Running Cross-Site Scripting (XSS) Attack Suite...");
  await testVector("XSS", "Reflected Script Tag (<script>alert(1)</script>)", "/api/v1/products?q=%3Cscript%3Ealert(1)%3C/script%3E");
  await testVector("XSS", "Image Onerror Event Handler", "/api/v1/products?q=%22%3E%3Cimg%20src=x%20onerror=alert(document.cookie)%3E");
  await testVector("XSS", "JavaScript URI Scheme (javascript:void(0))", "/api/v1/products?q=javascript:eval(atob('malicious'))");
  await testVector("XSS", "DOM Injection with Iframe", "/api/v1/products?q=%3Ciframe%20src=%22https://evil.com%22%3E");

  /* ──────────────────────────────────────────────────────────
   * SUITE 3: Path Traversal & Local File Inclusion (LFI)
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [3/6] Running Path Traversal & LFI Suite...");
  await testVector("LFI", "Unix Path Traversal (../../etc/passwd)", "/api/v1/products?q=../../../../etc/passwd");
  await testVector("LFI", "Windows Path Traversal (win.ini)", "/api/v1/products?q=..\\..\\..\\windows\\win.ini");
  await testVector("LFI", "URL-Encoded Path Traversal (%2e%2e%2f)", "/api/v1/products?q=%2e%2e%2f%2e%2e%2fetc%2fpasswd");

  /* ──────────────────────────────────────────────────────────
   * SUITE 4: Command Injection & Scanner Bot Fingerprinting
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [4/6] Running Command Injection & Malicious Bot Suite...");
  await testVector("RCE", "Semicolon Command Chaining (; cat /etc/passwd)", "/api/v1/products?q=%3B%20cat%20/etc/passwd");
  await testVector("RCE", "Pipe Command Injection (| whoami)", "/api/v1/products?q=%7C%20whoami");
  await testVector("Scanner Bot", "SQLMap Automated Scanner Detection", "/api/v1/products", {
    headers: { "user-agent": "sqlmap/1.6#stable (https://sqlmap.org)" },
  });
  await testVector("Scanner Bot", "Nikto Web Vulnerability Scanner", "/api/v1/products", {
    headers: { "user-agent": "Mozilla/5.00 (Nikto/2.1.6) (Evasions:None) (Test:Port Check)" },
  });

  /* ──────────────────────────────────────────────────────────
   * SUITE 5: Broken Object Level Authorization (BOLA/IDOR)
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [5/6] Running Broken Authorization & Admin Privilege Suite...");
  await testVector("Auth", "Admin Dashboard Unauthorized Access (No Token)", "/api/v1/admin/stats");
  await testVector("Auth", "Admin Access with Forged Bearer Token", "/api/v1/admin/stats", {
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature" },
  });

  /* ──────────────────────────────────────────────────────────
   * SUITE 6: Security Headers & Info Disclosure
   * ────────────────────────────────────────────────────────── */
  console.log("🔍 [6/6] Checking Security Headers & Information Disclosure...");
  try {
    const res = await fetch(`${API_BASE}/health`);
    const csp = res.headers.get("content-security-policy");
    const xfo = res.headers.get("x-frame-options");
    const xcto = res.headers.get("x-content-type-options");
    const xss = res.headers.get("x-xss-protection");
    const poweredBy = res.headers.get("x-powered-by");

    results.push({
      category: "Headers",
      testName: "Content Security Policy (CSP)",
      payload: "Header: Content-Security-Policy",
      status: csp ? "PASSED" : "FAILED",
      httpCode: res.status,
      expectedDefended: true,
      notes: csp ? "CSP active and enforcing directives" : "Missing CSP header",
    });

    results.push({
      category: "Headers",
      testName: "Clickjacking Defense (X-Frame-Options: DENY)",
      payload: "Header: X-Frame-Options",
      status: xfo === "DENY" ? "PASSED" : "FAILED",
      httpCode: res.status,
      expectedDefended: true,
      notes: `Value: ${xfo || "missing"}`,
    });

    results.push({
      category: "Headers",
      testName: "MIME-Sniffing Defense (X-Content-Type-Options: nosniff)",
      payload: "Header: X-Content-Type-Options",
      status: xcto === "nosniff" ? "PASSED" : "FAILED",
      httpCode: res.status,
      expectedDefended: true,
      notes: `Value: ${xcto || "missing"}`,
    });

    results.push({
      category: "Headers",
      testName: "XSS Filter Defense (X-XSS-Protection: 1; mode=block)",
      payload: "Header: X-XSS-Protection",
      status: xss?.includes("mode=block") ? "PASSED" : "FAILED",
      httpCode: res.status,
      expectedDefended: true,
      notes: `Value: ${xss || "missing"}`,
    });

    results.push({
      category: "Info Leak",
      testName: "Technology Fingerprint Suppression (No X-Powered-By)",
      payload: "Header: X-Powered-By",
      status: !poweredBy ? "PASSED" : "FAILED",
      httpCode: res.status,
      expectedDefended: true,
      notes: !poweredBy ? "Framework banner concealed" : `Leaked: ${poweredBy}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      category: "Headers",
      testName: "Security Headers Check",
      payload: "/health",
      status: "FAILED",
      httpCode: 0,
      expectedDefended: true,
      notes: errorMsg,
    });
  }

  // Final Summary Report
  console.log("\n====================================================================");
  console.log("📊 RED TEAM AUDIT SCORECARD");
  console.log("====================================================================");

  let passedCount = 0;
  for (const r of results) {
    const icon = r.status === "PASSED" ? "✅" : "❌";
    console.log(`${icon} [${r.status}] [${r.category.padEnd(11)}] ${r.testName.padEnd(46)} -> ${r.notes}`);
    if (r.status === "PASSED") passedCount++;
  }

  const scorePct = Math.round((passedCount / results.length) * 100);
  console.log("====================================================================");
  console.log(`🎯 DEFENSE SCORE: ${scorePct}% (${passedCount}/${results.length} Tests Defended)`);
  if (scorePct === 100) {
    console.log("🏆 VERDICT: FORTIFIED! Blue Team WAF successfully deflected 100% of attack vectors.");
  } else {
    console.log("⚠️  VERDICT: Vulnerabilities detected. Review failed vectors above.");
  }
  console.log("====================================================================\n");
}

runRedTeamAudit().catch(console.error);
