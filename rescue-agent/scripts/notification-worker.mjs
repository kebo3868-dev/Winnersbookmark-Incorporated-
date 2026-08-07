#!/usr/bin/env node
/**
 * Standalone notification worker.
 *
 * Drives the application's scheduled-dispatch endpoint on an interval. For
 * deployments that run a long-lived process (the provided Dockerfile, a VM, a
 * container platform) and therefore have no managed cron.
 *
 *   npm run worker:notifications
 *
 * It calls the same HTTP trigger a managed scheduler would, rather than
 * importing application code directly. That keeps one dispatch code path —
 * the one covered by tests — instead of a second, differently-wired copy that
 * could drift from it.
 *
 * Environment:
 *   APP_URL                          base URL of the running app (default http://127.0.0.1:3000)
 *   CRON_SECRET                      shared secret; must match the app's
 *   NOTIFICATION_WORKER_INTERVAL_MS  poll interval (default 30000, min 5000)
 *
 * Safe to run several replicas: claiming is atomic (FOR UPDATE SKIP LOCKED),
 * so workers take disjoint batches rather than sending the same alert twice.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const appUrl = (process.env.APP_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const secret = process.env.CRON_SECRET;
const intervalMs = Math.max(5_000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? 30_000));

if (!secret || secret.length < 16) {
  console.error('[worker] CRON_SECRET must be set and at least 16 characters. Refusing to start.');
  process.exit(1);
}

let running = true;
const stop = (signal) => {
  console.log(`[worker] ${signal} received, finishing the current cycle`);
  running = false;
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

console.log(`[worker] starting; target=${appUrl} interval=${intervalMs}ms`);

/** Consecutive failures, used only to keep the log from flooding. */
let consecutiveFailures = 0;

while (running) {
  try {
    const response = await fetch(`${appUrl}/api/frontdesk/notifications/cron`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      consecutiveFailures++;
      if (consecutiveFailures <= 3 || consecutiveFailures % 20 === 0) {
        console.error(`[worker] dispatch failed (${response.status}): ${body.detail ?? body.error ?? 'unknown'}`);
      }
    } else {
      consecutiveFailures = 0;
      if (body.processed > 0) {
        console.log(
          `[worker] processed=${body.processed} sent=${body.sent} ` +
            `retry=${body.retryScheduled} abandoned=${body.abandoned} simulated=${body.simulated}`,
        );
      }
    }
  } catch (error) {
    // The loop must survive anything. A worker that exits on one bad cycle
    // stops every restaurant's alerts, which is worse than a noisy log.
    consecutiveFailures++;
    if (consecutiveFailures <= 3 || consecutiveFailures % 20 === 0) {
      console.error(`[worker] cycle error: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!running) break;
  await sleep(intervalMs);
}

console.log('[worker] stopped');
