import { Logger } from "@nestjs/common";

import { structuredLog } from "./structured-log";

export type SecurityMetricName =
  | "login_success"
  | "login_failed"
  | "refresh_success"
  | "refresh_failed"
  | "logout"
  | "session_revoked"
  | "rate_limit_block"
  | "requests_total"
  | "requests_4xx"
  | "requests_5xx";

interface RequestMetricInput {
  method?: string;
  path: string;
  statusCode?: number;
  durationMs: number;
  requestId?: string;
}

interface SecurityEventInput {
  key?: string;
  requestId?: string;
  reason?: string;
}

interface RollingEvent {
  key: string;
  timestamp: number;
}

interface EndpointMetric {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
}

const suspiciousThresholds: Partial<
  Record<SecurityMetricName, { limit: number; windowMs: number }>
> = {
  login_failed: { limit: 8, windowMs: 10 * 60 * 1000 },
  refresh_failed: { limit: 5, windowMs: 10 * 60 * 1000 },
  rate_limit_block: { limit: 10, windowMs: 10 * 60 * 1000 },
  session_revoked: { limit: 5, windowMs: 10 * 60 * 1000 }
};

class SecurityMetricsStore {
  private readonly logger = new Logger("SecurityMetrics");
  private readonly startedAt = new Date();
  private readonly counters = new Map<SecurityMetricName, number>();
  private readonly endpoints = new Map<string, EndpointMetric>();
  private readonly rollingEvents = new Map<SecurityMetricName, RollingEvent[]>();

  increment(metric: SecurityMetricName, value = 1) {
    this.counters.set(metric, this.getCounter(metric) + value);
  }

  recordRequest(input: RequestMetricInput) {
    this.increment("requests_total");

    if (input.statusCode && input.statusCode >= 400 && input.statusCode < 500) {
      this.increment("requests_4xx");
    }

    if (input.statusCode && input.statusCode >= 500) {
      this.increment("requests_5xx");
    }

    if (input.statusCode === 429) {
      this.recordSecurityEvent("rate_limit_block", {
        key: normalizeEndpoint(input.method, input.path),
        requestId: input.requestId
      });
    }

    const endpointKey = normalizeEndpoint(input.method, input.path);
    const endpoint = this.endpoints.get(endpointKey) ?? {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0
    };

    endpoint.count += 1;
    endpoint.totalDurationMs += input.durationMs;
    endpoint.maxDurationMs = Math.max(endpoint.maxDurationMs, input.durationMs);

    if (input.statusCode && input.statusCode >= 200 && input.statusCode < 300) {
      endpoint.status2xx += 1;
    } else if (input.statusCode && input.statusCode >= 300 && input.statusCode < 400) {
      endpoint.status3xx += 1;
    } else if (input.statusCode && input.statusCode >= 400 && input.statusCode < 500) {
      endpoint.status4xx += 1;
    } else if (input.statusCode && input.statusCode >= 500) {
      endpoint.status5xx += 1;
    }

    this.endpoints.set(endpointKey, endpoint);
  }

  recordSecurityEvent(metric: SecurityMetricName, input: SecurityEventInput = {}) {
    this.increment(metric);
    this.recordRollingEvent(metric, input);
  }

  snapshot() {
    return {
      service: "backend",
      startedAt: this.startedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).sort(([left], [right]) =>
          left.localeCompare(right)
        )
      ),
      endpoints: Object.fromEntries(
        Array.from(this.endpoints.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([endpoint, metric]) => [
            endpoint,
            {
              count: metric.count,
              avgDurationMs:
                metric.count > 0
                  ? Math.round(metric.totalDurationMs / metric.count)
                  : 0,
              maxDurationMs: metric.maxDurationMs,
              status2xx: metric.status2xx,
              status3xx: metric.status3xx,
              status4xx: metric.status4xx,
              status5xx: metric.status5xx
            }
          ])
      ),
      suspiciousWindows: Object.fromEntries(
        Array.from(this.rollingEvents.entries()).map(([metric, events]) => [
          metric,
          events.length
        ])
      )
    };
  }

  private getCounter(metric: SecurityMetricName) {
    return this.counters.get(metric) ?? 0;
  }

  private recordRollingEvent(metric: SecurityMetricName, input: SecurityEventInput) {
    const threshold = suspiciousThresholds[metric];

    if (!threshold) {
      return;
    }

    const now = Date.now();
    const key = input.key ?? "global";
    const events = (this.rollingEvents.get(metric) ?? []).filter(
      (event) => now - event.timestamp <= threshold.windowMs
    );

    events.push({ key, timestamp: now });
    this.rollingEvents.set(metric, events);

    const matchingEvents = events.filter((event) => event.key === key);

    if (matchingEvents.length >= threshold.limit) {
      structuredLog(this.logger, "warn", {
        event: "suspicious_security_pattern",
        requestId: input.requestId,
        metric,
        key,
        count: matchingEvents.length,
        windowMs: threshold.windowMs,
        reason: input.reason
      });
    }
  }
}

export const securityMetrics = new SecurityMetricsStore();

function normalizeEndpoint(method: string | undefined, path: string) {
  const normalizedPath = path
    .split("?")[0]
    .split("/")
    .map((part) => {
      if (!part) {
        return part;
      }

      if (/^\d+$/.test(part)) {
        return ":id";
      }

      if (/^[a-z0-9]{20,}$/i.test(part)) {
        return ":id";
      }

      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part)) {
        return ":id";
      }

      return part;
    })
    .join("/");

  return `${method ?? "UNKNOWN"} ${normalizedPath}`;
}
