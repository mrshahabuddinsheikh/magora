import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * BLUE TEAM SECURITY SYSTEM
 * Real-time Web Application Firewall (WAF), Threat Detector,
 * Intrusion Prevention System (IPS), and Security Audit Logger.
 */

export interface SecurityEvent {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  threatType: "sqli" | "xss" | "path_traversal" | "command_injection" | "scanner_bot" | "rate_abuse";
  severity: "high" | "critical";
  matchedPattern: string;
  userAgent?: string;
}

// In-memory threat tracking & IP ban table
class ThreatProtectionSystem {
  private events: SecurityEvent[] = [];
  private violationCounts = new Map<string, { count: number; firstSeen: number }>();
  private bannedIps = new Map<string, number>(); // ip -> unbanTimestamp
  private maxEvents = 1000;

  // Signatures for attacks
  private sqliPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /(union([\s\+]+)select)/i,
    /(select([\s\+]+).+from)/i,
    /(insert([\s\+]+)into)/i,
    /(delete([\s\+]+)from)/i,
    /(drop([\s\+]+)table)/i,
    /(waitfor([\s\+]+)delay)/i,
    /(benchmark\s*\()/i,
    /(sleep\s*\(\s*[0-9]+\s*\))/i,
  ];

  private xssPatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/i,
    /javascript\s*:/i,
    /on(load|error|click|mouseover|submit|focus|blur)\s*=/i,
    /<(iframe|object|embed|svg|img|body|link)\b[^>]*>/i,
    /eval\s*\(/i,
    /document\.(cookie|location|write)/i,
  ];

  private traversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /\%2e\%2e\%2f/i,
    /\%2e\%2e\//i,
    /\/etc\/(passwd|shadow|hosts)/i,
    /windows[\/\\]win\.ini/i,
  ];

  private commandInjectionPatterns = [
    /[;&|`]\s*(cat|ls|whoami|id|wget|curl|nc|bash|sh|cmd|powershell)\b/i,
    /\$\([^)]+\)/i,
  ];

  private scannerBots = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /dirbuster/i,
    /masscan/i,
    /wpscan/i,
    /acunetix/i,
    /havij/i,
  ];

  isBanned(ip: string): boolean {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost") return false;
    const unbanAt = this.bannedIps.get(ip);
    if (!unbanAt) return false;
    if (Date.now() > unbanAt) {
      this.bannedIps.delete(ip);
      return false;
    }
    return true;
  }

  banIp(ip: string, durationMs = 60 * 60 * 1000) {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost") return;
    this.bannedIps.set(ip, Date.now() + durationMs);
  }

  unbanIp(ip: string) {
    this.bannedIps.delete(ip);
    this.violationCounts.delete(ip);
  }

  recordViolation(ip: string) {
    const now = Date.now();
    const entry = this.violationCounts.get(ip);
    if (!entry || now - entry.firstSeen > 10 * 60 * 1000) {
      this.violationCounts.set(ip, { count: 1, firstSeen: now });
    } else {
      entry.count += 1;
      // Auto-ban after 5 severe violations within 10 minutes
      if (entry.count >= 5) {
        this.banIp(ip, 60 * 60 * 1000); // 1 hour ban
      }
    }
  }

  inspect(req: FastifyRequest): { detected: boolean; type?: SecurityEvent["threatType"]; pattern?: string } {
    const ip = req.ip || "unknown";
    if (this.isBanned(ip)) {
      return { detected: true, type: "rate_abuse", pattern: "IP_BANNED" };
    }

    const ua = req.headers["user-agent"] || "";
    for (const b of this.scannerBots) {
      if (b.test(ua)) {
        return { detected: true, type: "scanner_bot", pattern: b.source };
      }
    }

    // Inspect URL & Query
    const urlDecoded = decodeURIComponent(req.url);
    const inspectStr = `${urlDecoded} ${JSON.stringify(req.query || {})} ${JSON.stringify(req.params || {})}`;

    for (const p of this.sqliPatterns) {
      if (p.test(inspectStr)) return { detected: true, type: "sqli", pattern: p.source };
    }
    for (const p of this.xssPatterns) {
      if (p.test(inspectStr)) return { detected: true, type: "xss", pattern: p.source };
    }
    for (const p of this.traversalPatterns) {
      if (p.test(inspectStr)) return { detected: true, type: "path_traversal", pattern: p.source };
    }
    for (const p of this.commandInjectionPatterns) {
      if (p.test(inspectStr)) return { detected: true, type: "command_injection", pattern: p.source };
    }

    // Inspect body if present
    if (req.body && typeof req.body === "object") {
      const bodyStr = JSON.stringify(req.body);
      for (const p of this.sqliPatterns) {
        if (p.test(bodyStr)) return { detected: true, type: "sqli", pattern: p.source };
      }
      for (const p of this.xssPatterns) {
        if (p.test(bodyStr)) return { detected: true, type: "xss", pattern: p.source };
      }
      for (const p of this.traversalPatterns) {
        if (p.test(bodyStr)) return { detected: true, type: "path_traversal", pattern: p.source };
      }
    }

    return { detected: false };
  }

  logEvent(req: FastifyRequest, type: SecurityEvent["threatType"], pattern: string) {
    const ip = req.ip || "unknown";
    this.recordViolation(ip);
    const event: SecurityEvent = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      ip,
      method: req.method,
      url: req.url,
      threatType: type,
      severity: type === "sqli" || type === "command_injection" ? "critical" : "high",
      matchedPattern: pattern,
      userAgent: req.headers["user-agent"],
    };
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
    return event;
  }

  getStats() {
    const activeBans = Array.from(this.bannedIps.entries())
      .filter(([_, unban]) => unban > Date.now())
      .map(([ip, unban]) => ({ ip, unbanInSeconds: Math.round((unban - Date.now()) / 1000) }));

    const threatsByType: Record<string, number> = {};
    for (const ev of this.events) {
      threatsByType[ev.threatType] = (threatsByType[ev.threatType] || 0) + 1;
    }

    return {
      totalBlockedThreats: this.events.length,
      threatsByType,
      activeBannedIpsCount: activeBans.length,
      bannedIps: activeBans,
      recentEvents: this.events.slice(0, 50),
    };
  }
}

export const threatProtection = new ThreatProtectionSystem();

/**
 * Registers Blue Team WAF and Security Headers onto Fastify
 */
export function registerBlueTeamSecurity(app: FastifyInstance) {
  // Pre-handler WAF filter
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip health check
    if (req.url === "/health") return;

    const result = threatProtection.inspect(req);
    if (result.detected) {
      threatProtection.logEvent(req, result.type!, result.pattern!);
      req.log.warn({ ip: req.ip, url: req.url, threat: result.type }, "Security threat blocked by Blue Team WAF");
      return reply.code(403).send({
        error: {
          code: "security_violation",
          message: "Request blocked by Web Application Firewall (WAF). This incident has been logged.",
        },
      });
    }
  });

  // Hardened Security Headers on all responses
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("x-xss-protection", "1; mode=block");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-permitted-cross-domain-policies", "none");
    reply.header("cross-origin-resource-policy", "cross-origin");
    reply.header("permissions-policy", "camera=(), microphone=(), payment=(self), geolocation=()");
    reply.header(
      "content-security-policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* https:; frame-ancestors 'none'; object-src 'none';",
    );
  });
}
