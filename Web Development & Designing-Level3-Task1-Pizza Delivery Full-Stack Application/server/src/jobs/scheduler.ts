import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { evaluateLowStock } from '../services/alert.service';
import { expireStaleReservations } from '../services/order.service';
import { logger } from '../utils/logger';

const tasks: ScheduledTask[] = [];

function guarded(name: string, fn: () => Promise<unknown>) {
  let running = false;
  return async () => {
    if (running) return logger.warn('Scheduled job skipped: previous run still in progress', { job: name });
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error('Scheduled job failed', { job: name, err }); // never crashes the process
    } finally {
      running = false;
    }
  };
}

/**
 * Starts cron jobs in THIS process only. Run with ENABLE_SCHEDULER=true on exactly one instance.
 * Even if several instances run it, both jobs are safe: alert emails use an atomic claim and
 * reservation expiry uses conditional updates, so work is never duplicated.
 */
export function startScheduler() {
  if (!cron.validate(env.LOW_STOCK_CHECK_SCHEDULE)) {
    throw new Error(`Invalid LOW_STOCK_CHECK_SCHEDULE: "${env.LOW_STOCK_CHECK_SCHEDULE}"`);
  }
  tasks.push(cron.schedule(env.LOW_STOCK_CHECK_SCHEDULE, guarded('low-stock-check', () => evaluateLowStock())));
  tasks.push(cron.schedule('*/2 * * * *', guarded('reservation-expiry', () => expireStaleReservations())));
  logger.info('Scheduler started', { lowStockSchedule: env.LOW_STOCK_CHECK_SCHEDULE });
}

export function stopScheduler() {
  tasks.splice(0).forEach((t) => t.stop());
}
