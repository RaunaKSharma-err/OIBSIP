import { isDbReady } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';

export const live = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() } });
});

export const ready = asyncHandler(async (_req, res) => {
  const db = await isDbReady();
  res.status(db ? 200 : 503).json({
    success: db,
    data: { status: db ? 'ready' : 'unavailable', checks: { database: db ? 'up' : 'down' } },
  });
});
