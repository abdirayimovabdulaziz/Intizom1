/**
 * Server Configuration & Security Validation Module
 * Enforces strict environment invariants between Production and Development/Test.
 */

export const DEV_DEFAULT_SESSION_SECRET = 'kunlik-yordamchi-default-dev-secret-32-chars';

export interface ServerConfig {
  nodeEnv: 'production' | 'development' | 'test';
  isProd: boolean;
  port: number;
  sessionSecret: string;
  telegramBotToken: string;
  allowDemoAuth: boolean;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
}

const INSECURE_SECRET_PATTERNS = [
  'kunlik-yordamchi-default',
  'change-this',
  'default-dev-secret',
  'secret-key',
  '123456',
  'password',
];

/**
 * Validates environment variables for production security.
 * Throws a descriptive fatal error in production if any critical secret or database config is missing or insecure.
 */
export function validateServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const nodeEnv = (env.NODE_ENV === 'production'
    ? 'production'
    : env.NODE_ENV === 'test'
    ? 'test'
    : 'development') as 'production' | 'development' | 'test';

  const isProd = nodeEnv === 'production';
  const port = Number(env.PORT) || 3000;

  // 1. SESSION_SECRET Validation
  let sessionSecret = env.SESSION_SECRET?.trim() || '';

  if (isProd) {
    if (!sessionSecret) {
      throw new Error(
        '[FATAL CONFIG] Production muhitida SESSION_SECRET sozlanmagan. Server ishga tusha olmaydi.'
      );
    }

    if (sessionSecret.length < 32) {
      throw new Error(
        `[FATAL CONFIG] Production muhitida SESSION_SECRET uzunligi kamida 32 ta belgi bo‘lishi shart (Hozirgi: ${sessionSecret.length}).`
      );
    }

    const lowerSecret = sessionSecret.toLowerCase();
    for (const pattern of INSECURE_SECRET_PATTERNS) {
      if (lowerSecret.includes(pattern)) {
        throw new Error(
          '[FATAL CONFIG] Production muhitida koddagi standart dev secret yoki namunaviy kalitlardan foydalanish qat‘iyan taqiqlanadi.'
        );
      }
    }
  } else {
    // In dev / test, fallback to dev secret if not provided
    if (!sessionSecret) {
      sessionSecret = DEV_DEFAULT_SESSION_SECRET;
    }
  }

  // 2. TELEGRAM_BOT_TOKEN Validation
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN?.trim() || '';
  if (isProd && !telegramBotToken) {
    throw new Error(
      '[FATAL CONFIG] Production muhitida TELEGRAM_BOT_TOKEN sozlanmagan. Telegram imzolarini tekshirib bo‘lmaydi.'
    );
  }

  // 3. SUPABASE DATABASE CONFIGURATION Validation
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (isProd) {
    if (!supabaseUrl || !supabaseServiceRoleKey || supabaseUrl.includes('MY_SUPABASE')) {
      throw new Error(
        '[FATAL CONFIG] Production muhitida jonli PostgreSQL uchun SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY to‘liq sozlanishi shart! Production muhitida In-Memory repository fallback taqiqlangan.'
      );
    }

    try {
      new URL(supabaseUrl);
    } catch {
      throw new Error(`[FATAL CONFIG] SUPABASE_URL haqiqiy URL formatida emas: "${supabaseUrl}".`);
    }
  }

  // 4. DEMO AUTHENTICATION Isolation
  // In production, demo mode is ALWAYS strictly disabled, regardless of ALLOW_DEMO_AUTH setting.
  const allowDemoAuth = isProd ? false : env.ALLOW_DEMO_AUTH === 'true';

  return {
    nodeEnv,
    isProd,
    port,
    sessionSecret,
    telegramBotToken,
    allowDemoAuth,
    supabaseUrl: supabaseUrl && !supabaseUrl.includes('MY_SUPABASE') ? supabaseUrl : undefined,
    supabaseServiceRoleKey:
      supabaseServiceRoleKey && !supabaseServiceRoleKey.includes('MY_SUPABASE')
        ? supabaseServiceRoleKey
        : undefined,
  };
}
