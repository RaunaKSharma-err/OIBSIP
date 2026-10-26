import { env } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const weight: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /pass|secret|token|authorization|cookie|signature|apikey|api_key|cvv|card|^key$|keyid/i;

function redact(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(env.NODE_ENV !== 'production' ? { stack: value.stack } : {}),
    };
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (weight[level] < weight[env.LOG_LEVEL]) return;
  if (env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...(redact(meta) as object) });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
};
