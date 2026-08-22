/**
 * outbreak-aggregator — Scheduled job for N2 Regional Outbreak Signal.
 * Section 4.3.
 *
 * Groups DiagnosisEvents by geohash5km + identified_condition over a
 * rolling window. If the count crosses the threshold, emits an OutbreakAlert.
 *
 * Severity bands:
 *   5–9   → "Watch"
 *   10–19 → "Elevated"
 *   20+   → "High"
 *
 * @see Section 4.3  — N2 spec, Regional Outbreak Signal
 * @see Section 11   — Scheduling: Cloud Scheduler / Cloud Functions (cron)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import type { DiagnosisEvent, OutbreakAlert, OutbreakSeverity } from '@harvestnet/schemas';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.OUTBREAK_AGGREGATOR_PORT || 3007;
const THRESHOLD_COUNT = parseInt(process.env.OUTBREAK_ALERT_THRESHOLD_COUNT || '5', 10);
const WINDOW_DAYS = parseInt(process.env.OUTBREAK_ALERT_WINDOW_DAYS || '5', 10);

// ── In-memory stores (Firestore in production) ────────────────────────────

/** All diagnosis events received from vision-api via dpi-gateway */
const diagnosisEvents: DiagnosisEvent[] = [];

/** Active outbreak alerts */
const outbreakAlerts: OutbreakAlert[] = [];

// ── Core aggregation logic ────────────────────────────────────────────────

/**
 * Classify outbreak severity based on farmer report count.
 *
 * Severity bands (Section 4.3):
 *   5–9   → "Watch"
 *   10–19 → "Elevated"
 *   20+   → "High"
 */
function classifySeverity(count: number): OutbreakSeverity {
  if (count >= 20) return 'High';
  if (count >= 10) return 'Elevated';
  return 'Watch';
}

/**
 * Run the outbreak aggregation job.
 *
 * Section 4.3 algorithm:
 * 1. Query DiagnosisEvents within rolling OUTBREAK_ALERT_WINDOW_DAYS
 * 2. Group by geohash5km + identified_condition
 * 3. If count >= OUTBREAK_ALERT_THRESHOLD_COUNT → emit OutbreakAlert
 *
 * In production, this runs as a Cloud Scheduler cron job.
 */
function runAggregation(): OutbreakAlert[] {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Step 1: Filter events within the rolling window
  const recentEvents = diagnosisEvents.filter(
    (e) => new Date(e.timestamp) >= windowStart
  );

  // Step 2: Group by geohash5km + identified_condition
  const groups = new Map<string, DiagnosisEvent[]>();
  for (const event of recentEvents) {
    const key = `${event.geohash5km}::${event.identified_condition}`;
    const group = groups.get(key) || [];
    group.push(event);
    groups.set(key, group);
  }

  // Step 3: Emit alerts for groups crossing the threshold
  const newAlerts: OutbreakAlert[] = [];
  for (const [key, events] of groups) {
    if (events.length >= THRESHOLD_COUNT) {
      const [geohash5km, condition] = key.split('::');

      // Check if we already have an active alert for this geohash+condition
      const existingAlert = outbreakAlerts.find(
        (a) => a.geohash5km === geohash5km && a.condition === condition
      );

      if (existingAlert) {
        // Update existing alert with new count and severity
        existingAlert.farmer_report_count = events.length;
        existingAlert.severity = classifySeverity(events.length);
        existingAlert.window_end = now.toISOString();
        newAlerts.push(existingAlert);
      } else {
        // Create new alert
        const alert: OutbreakAlert = {
          alert_id: uuidv4(),
          geohash5km: geohash5km!,
          condition: condition!,
          farmer_report_count: events.length,
          window_start: windowStart.toISOString(),
          window_end: now.toISOString(),
          severity: classifySeverity(events.length),
        };
        outbreakAlerts.push(alert);
        newAlerts.push(alert);
      }
    }
  }

  console.log(
    `[outbreak-aggregator] Aggregation complete: ${recentEvents.length} events, ` +
    `${groups.size} groups, ${newAlerts.length} alerts`
  );

  return newAlerts;
}

// ── Routes ────────────────────────────────────────────────────────────────

/**
 * POST /events
 * Ingest a DiagnosisEvent from vision-api (via dpi-gateway).
 * Section 4.3: "Every disease diagnosis emits a DiagnosisEvent"
 */
app.post('/events', (req, res) => {
  const event: DiagnosisEvent = req.body;

  if (!event.event_id || !event.geohash5km || !event.identified_condition) {
    res.status(400).json({ error: 'Invalid DiagnosisEvent' });
    return;
  }

  diagnosisEvents.push(event);
  console.log(
    `[outbreak-aggregator] Ingested event ${event.event_id}: ` +
    `${event.identified_condition} at ${event.geohash5km}`
  );

  res.status(201).json({ status: 'accepted', event_id: event.event_id });
});

/**
 * POST /aggregate
 * Trigger the aggregation job manually (for testing/demo).
 * In production, this is triggered by Cloud Scheduler.
 */
app.post('/aggregate', (_req, res) => {
  const alerts = runAggregation();
  res.json({ alerts_generated: alerts.length, alerts });
});

/**
 * GET /api/v1/alerts/regional
 * List active regional outbreak alerts (N2).
 * Section 8: consumed by the partner dashboard.
 *
 * Optional query param: geohash5km (filter by region)
 */
app.get('/api/v1/alerts/regional', (req, res) => {
  const geohashFilter = req.query.geohash5km as string | undefined;

  let alerts = outbreakAlerts;
  if (geohashFilter) {
    alerts = alerts.filter((a) => a.geohash5km === geohashFilter);
  }

  res.json(alerts);
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'outbreak-aggregator',
    novelty: 'N2',
    config: {
      threshold_count: THRESHOLD_COUNT,
      window_days: WINDOW_DAYS,
    },
    stats: {
      total_events: diagnosisEvents.length,
      active_alerts: outbreakAlerts.length,
    },
  });
});

// ── Auto-aggregation interval (simulates Cloud Scheduler cron) ────────────
const AGGREGATION_INTERVAL_MS = parseInt(
  process.env.AGGREGATION_INTERVAL_MS || '60000',
  10
); // Default: 1 minute

setInterval(() => {
  runAggregation();
}, AGGREGATION_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`[outbreak-aggregator] N2 service listening on port ${PORT}`);
  console.log(
    `  Threshold: ${THRESHOLD_COUNT} reports | Window: ${WINDOW_DAYS} days | ` +
    `Interval: ${AGGREGATION_INTERVAL_MS}ms`
  );
});

export { runAggregation, classifySeverity, diagnosisEvents, outbreakAlerts };
export default app;
