import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const {
    windowMs,
    maxRequests,
    message = 'Juda ko‘p so‘rov yuborildi. Iltimos, birozdan keyin qayta urinib ko‘ring.',
    keyGenerator = (req: Request) => {
      // Prioritize authenticated user ID, fallback to client IP
      return (req as any).user?.id || req.ip || req.socket.remoteAddress || 'unknown';
    },
  } = options;

  const storage = new Map<string, RateLimitRecord>();

  // Periodically clean up stale records every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of storage.entries()) {
      record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        storage.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = storage.get(key);
    if (!record) {
      record = { timestamps: [] };
      storage.set(key, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: message,
        retryAfterSeconds,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
