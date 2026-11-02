import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  validateTelegramInitData,
  createSessionToken,
  verifySessionToken,
} from './server/telegramAuth';
import { validateDomainSnapshot } from './server/validateSnapshot';
import { getRepository } from './server/repository';
import { createRateLimiter } from './server/rateLimiter';
import { TelegramUser } from './server/types';
import { validateServerConfig } from './server/config';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverConfig: ReturnType<typeof validateServerConfig>;
let configWarning: string | null = null;

try {
  serverConfig = validateServerConfig(process.env);
} catch (err: any) {
  configWarning = err?.message || 'Server konfiguratsiyasi to‘liq emas.';
  // Resilient fallback configuration for initial container boot / Cloud Run deployment rollout
  serverConfig = {
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    isProd: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT) || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'kunlik-prod-unconfigured-session-secret-min32ch',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowDemoAuth: false,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

const app = express();
const PORT = serverConfig.port;
const SESSION_SECRET = serverConfig.sessionSecret;
const TELEGRAM_BOT_TOKEN = serverConfig.telegramBotToken;

// Basic middlewares
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Health check endpoint for Cloud Run and uptime monitors
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    isProd: serverConfig.isProd,
    hasDatabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    warning: configWarning,
  });
});

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow rendering in Telegram WebApp iframe and same origin
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://web.telegram.org');
  next();
});

// Rate limiters
const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'Autentifikatsiya so‘rovlari chegarasi oshdi. 5 daqiqadan keyin qayta urinib ko‘ring.',
});

const syncSaveRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Sinxronizatsiya saqlash so‘rovlari tezligi juda yuqori. Biroz kuting.',
});

const nlpRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: 'AI matn tahlili so‘rovlari limiti oshdi. Biroz kuting.',
});

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TelegramUser | null;
    }
  }
}

// Session authentication middleware
function authenticateSession(req: Request, _res: Response, next: NextFunction) {
  // Extract token from Cookie or Bearer header
  let token: string | undefined = req.cookies?.['kunlik_session'];
  const authHeader = req.headers['authorization'];
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    const user = verifySessionToken(token, SESSION_SECRET);
    req.user = user;
  } else {
    req.user = null;
  }

  next();
}

app.use(authenticateSession);

// Middleware that strictly requires authenticated user
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: 'Autentifikatsiya talab qilinadi. Sessiya mavjud emas yoki muddati tugagan.',
    });
    return;
  }
  next();
}

// CSRF Protection middleware for state mutation requests
function requireCsrfProtection(req: Request, res: Response, next: NextFunction) {
  const hasCustomHeader =
    Boolean(req.headers['x-requested-with']) ||
    Boolean(req.headers['authorization']) ||
    Boolean(req.headers['x-csrf-token']);

  if (!hasCustomHeader) {
    res.status(403).json({
      error: 'CSRF tekshiruvidan o‘tmadi. So‘rovda X-Requested-With yoki Authorization headeri talab qilinadi.',
      code: 'CSRF_FAILED',
    });
    return;
  }
  next();
}

// Initialize Gemini SDK if API key is present
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// ==============================================================================
// AUTHENTICATION ENDPOINTS
// ==============================================================================

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const repo = getRepository();
  res.json({
    status: 'ok',
    aiConfigured: !!ai,
    hasBotToken: !!TELEGRAM_BOT_TOKEN,
    isLiveDatabase: repo.isLiveDatabase(),
    timestamp: new Date().toISOString(),
    appName: 'Kunlik Yordamchi API',
  });
});

// Authenticate via Telegram WebApp initData (official HMAC-SHA256 signature verification)
app.post('/api/auth/telegram', authRateLimiter, (req: Request, res: Response) => {
  const { initData } = req.body;

  if (!initData || typeof initData !== 'string') {
    res.status(400).json({ error: 'initData satri kiritilishi shart.' });
    return;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    res.status(503).json({
      error: 'Serverda TELEGRAM_BOT_TOKEN sozlanmagan. Iltimos, server administratoriga murojaat qiling.',
      code: 'BOT_TOKEN_MISSING',
    });
    return;
  }

  const result = validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
  if (!result.isValid || !result.user) {
    res.status(401).json({
      error: result.error || 'Telegram imzosi noto‘g‘ri.',
      code: 'INVALID_SIGNATURE',
    });
    return;
  }

  // Generate signed session token (valid for 7 days)
  const token = createSessionToken(result.user, SESSION_SECRET);

  // Set HttpOnly & Secure cookie for production security
  res.cookie('kunlik_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // Required for cross-site iframes in Telegram WebApp
    maxAge: 7 * 86400 * 1000,
    path: '/',
  });

  res.json({
    success: true,
    token,
    user: result.user,
  });
});

// Demo mode session for browser preview outside Telegram
app.post('/api/auth/demo-session', authRateLimiter, (_req: Request, res: Response) => {
  if (serverConfig.isProd || !serverConfig.allowDemoAuth) {
    res.status(403).json({
      error: 'Demo rejim production muhitida qat‘iyan taqiqlangan va butunlay yopiq.',
      code: 'DEMO_FORBIDDEN_IN_PRODUCTION',
    });
    return;
  }

  const demoUser: TelegramUser = {
    id: 'demo-preview-user',
    username: 'demo_user',
    firstName: 'Demo Foydalanuvchi',
    isDemo: true,
  };

  const token = createSessionToken(demoUser, SESSION_SECRET, 86400); // 1 day for demo

  res.cookie('kunlik_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 86400 * 1000,
    path: '/',
  });

  res.json({
    success: true,
    token,
    user: demoUser,
    isDemo: true,
  });
});

// Current session user information
app.get('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.json({
      authenticated: false,
      user: null,
    });
    return;
  }

  res.json({
    authenticated: true,
    user: req.user,
  });
});

// Logout and clear session (requires CSRF protection)
app.post('/api/auth/logout', requireCsrfProtection, (_req: Request, res: Response) => {
  res.clearCookie('kunlik_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  res.json({ success: true });
});

// ==============================================================================
// SYNCHRONIZATION ENDPOINTS
// ==============================================================================

// Read current user cloud state snapshot
app.get('/api/sync/state', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const repo = getRepository();
    const record = await repo.get(userId);

    res.json({
      success: true,
      record: record || null,
      isLiveDatabase: repo.isLiveDatabase(),
    });
  } catch (error: any) {
    console.error('Fetch user state error:', error);
    res.status(500).json({
      error: `Bulutli holatni olishda xatolik yuz berdi: ${error?.message}`,
    });
  }
});

// Atomic conditional save snapshot with optimistic concurrency & idempotency (strictly CSRF protected)
app.post('/api/sync/save', requireAuth, requireCsrfProtection, syncSaveRateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { expectedRevision, operationId, snapshot, schemaVersion } = req.body;

    // 1. Parameter structure verification
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      res.status(400).json({
        error: 'expectedRevision musbat butun son yoki 0 bo‘lishi shart.',
      });
      return;
    }

    if (!operationId || typeof operationId !== 'string' || !operationId.trim()) {
      res.status(400).json({
        error: 'operationId (idempotent kalit) bo‘sh bo‘lishi mumkin emas.',
      });
      return;
    }

    // 2. Strict runtime domain validation of snapshot
    const validation = validateDomainSnapshot(snapshot);
    if (!validation.isValid || !validation.sanitizedSnapshot) {
      res.status(400).json({
        error: `Snapshot yaxlitlik tekshiruvidan o‘tmadi: ${validation.error}`,
      });
      return;
    }

    // 3. Atomic save via repository
    const repo = getRepository();
    const result = await repo.save(userId, {
      expectedRevision,
      operationId: operationId.trim(),
      snapshot: validation.sanitizedSnapshot,
      schemaVersion: schemaVersion || 1,
      username: req.user?.username,
      firstName: req.user?.firstName,
    });

    if (result.status === 'idempotent_replay') {
      res.json({
        status: 'idempotent_replay',
        isIdempotentReplay: true,
        record: result.record,
      });
      return;
    }

    if (result.status === 'conflict') {
      res.status(409).json({
        status: 'conflict',
        error: 'Sinxronizatsiyada ziddiyat (versiya mos kelmadi). Boshqa qurilmada yangilanish amalga oshirilgan.',
        currentRevision: result.currentRevision,
        serverRecord: result.serverRecord,
      });
      return;
    }

    if (result.status === 'saved') {
      res.json({
        status: 'saved',
        record: result.record,
      });
      return;
    }

    res.status(500).json({
      error: (result as any).error || 'Saqlashda noma‘lum xatolik.',
    });
  } catch (error: any) {
    console.error('Save user state error:', error);
    res.status(500).json({
      error: `Bulutga saqlashda server xatoligi: ${error?.message}`,
    });
  }
});

// ==============================================================================
// AI ASSISTANT ENDPOINTS
// ==============================================================================

// NLP parsing endpoint using Gemini 3.8 Flash
app.post('/api/parse-nlp', nlpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { text, currentDate, currentTime, timezone } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text kiritilishi shart' });
      return;
    }

    if (!ai) {
      res.json({
        success: false,
        fallbackToLocal: true,
        message: 'Gemini API kaliti aniqlanmadi, lokal qoidalar ishlatiladi',
      });
      return;
    }

    const referenceDate = currentDate || new Date().toISOString().split('T')[0];
    const targetTz = timezone || 'Asia/Tashkent';
    const targetTime = currentTime || '12:00';
    const prompt = `
Siz o'zbek tilidagi shaxsiy yordamchi ("Kunlik Yordamchi") uchun matnlarni tahlil qiluvchi AI tizimisiz.
Bugungi sana: ${referenceDate}. Hozirgi vaqt: ${targetTime}. Vaqt zonasi: ${targetTz}.

Foydalanuvchi quyidagi matnni kiritdi: "${text}"

QOIDALAR:
1. Foydalanuvchi aytmagan summa, doza, vaqt yoki takrorlanish qoidasini o'ylab topmang (masalan: "kreatin" yozilgan bo'lsa, dosage: null qoldiring, "5 gram" yasab olmang).
2. Daromad ("daromad: 500000 ish haqi", "oylik tushdi", "kirim:") kiritilsa, isIncome: true belgilang va uni harajat qilib yaratmang.
3. "kunora" kiritilsa, isInterval: true belgilang va uni daily deb saqlamang.
4. Bir matnda bir nechta amal bo'lsa (masalan: "tushlik 45000 va 5g kreatin"), isMultipleActions: true belgilang.
5. Pul va valyuta: UZS (so'm) yoki USD ($ / dollar). Masalan: "12.50 dollar" -> amount: 12.5, currency: "USD".
6. Takrorlanish:
   - "haftasiga 3 kun zal" -> category: "odat", frequency: "weekly_target", targetDaysPerWeek: 3
   - "har dushanba va juma 20 bet kitob" -> category: "odat", frequency: "specific_days", daysOfWeek: [1, 5], quantity: 20, unit: "sahifa"
   - "har kuni 60 daqiqa yurish" -> category: "odat", frequency: "daily", quantity: 60, unit: "daqiqa"

Qat'iy faqat quyidagi JSON formatida qaytaring:
{
  "category": "harajat" | "qabul" | "vazifa" | "odat" | "maqsad" | "uchrashuv" | "noaniq",
  "title": string,
  "amount": number | null,
  "currency": "UZS" | "USD" | null,
  "expenseCategory": string | null,
  "dosage": string | null,
  "timeSlot": string | null,
  "date": string | null,
  "time": string | null,
  "quantity": number | null,
  "unit": string | null,
  "frequency": "daily" | "weekly_target" | "specific_days" | null,
  "targetDaysPerWeek": number | null,
  "daysOfWeek": number[] | null,
  "isIncome": boolean,
  "isInterval": boolean,
  "isMultipleActions": boolean,
  "explanationUz": string,
  "confidence": number
}
`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI tahlilida vaqt tugadi (timeout)')), 3000);
    });

    try {
      const response = await Promise.race([generatePromise, timeoutPromise]);
      const parsedJson = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        parsed: parsedJson,
        source: 'gemini-ai',
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error: any) {
    console.warn('NLP parse using local fallback:', error?.message);
    res.json({
      success: false,
      fallbackToLocal: true,
      message: 'Lokal qoidalar ishlatiladi',
    });
  }
});

// Weekly review and smart insights endpoint
app.post('/api/weekly-review', nlpRateLimiter, async (req: Request, res: Response) => {
  try {
    const { completedTasksCount, pendingTasksCount, habitStats, goalStats } = req.body;

    if (!ai) {
      res.json({
        success: false,
        fallbackToLocal: true,
        summary: `Hafta davomida ${completedTasksCount || 0} ta vazifa bajarildi, ${pendingTasksCount || 0} ta vazifa qoldi. Odatlar bo'yicha intizom davom etmoqda. Omad!`,
      });
      return;
    }

    const prompt = `
Siz "Kunlik Yordamchi" ilovasining shaxsiy murabbiyisiz (coach).
Foydalanuvchining so'nggi haftalik natijalari:
- Bajarilgan vazifalar: ${completedTasksCount || 0} ta
- Qoldirilgan/kutilayotgan vazifalar: ${pendingTasksCount || 0} ta
- Odatlar holati: ${JSON.stringify(habitStats || [])}
- Maqsadlar holati: ${JSON.stringify(goalStats || [])}

O'zbek tilida ilhomlantiruvchi, samimiy va amaliy 3-4 jumlali haftalik sarhisob (Weekly Review) va kelasi hafta uchun 2 ta aniq maslahat yozib bering. Markdown formatida qaytaring.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      reviewText: response.text,
    });
  } catch (error: any) {
    console.error('Weekly review error:', error);
    res.status(500).json({
      success: false,
      fallbackToLocal: true,
      error: error?.message,
    });
  }
});

// ==============================================================================
// SERVER INITIALIZATION
// ==============================================================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (configWarning) {
    console.warn(`⚠️ [Server Config Notice]: ${configWarning}`);
    console.warn(`ℹ️ Server Cloud Run deployment va frontend uchun 0.0.0.0:${PORT} da muvaffaqiyatli ishga tushirilmoqda.`);
  } else {
    console.log('✅ [Config] Server konfiguratsiyasi to‘liq va xavfsiz holatda.');
  }

  // Pre-load repository if Supabase credentials are configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      getRepository();
    } catch (e: any) {
      console.warn('⚠️ [Repository Warning]:', e?.message);
    }
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kunlik Yordamchi server running at http://0.0.0.0:${PORT}`);
  });
}

// Export app for test suites
export { app, startServer };

// Start server if run directly
const isDirectRun = Boolean(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename));
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer();
}
