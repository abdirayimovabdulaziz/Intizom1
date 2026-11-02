import crypto from 'crypto';
import { TelegramUser } from './types';

export interface TelegramValidationResult {
  isValid: boolean;
  error?: string;
  user?: TelegramUser;
  authDate?: number;
}

export interface SessionPayload {
  user: TelegramUser;
  iat: number;
  exp: number;
}

/**
 * Validates Telegram Mini App initData according to Telegram's official specification.
 *
 * Algorithm:
 * 1. Parse query parameters from initData.
 * 2. Extract and remove 'hash'.
 * 3. Sort remaining key=value pairs alphabetically in ascending order.
 * 4. Join pairs with newline '\n' to form data_check_string.
 * 5. Calculate secret_key = HMAC_SHA256('WebAppData', botToken).
 * 6. Calculate hash = HMAC_SHA256(secret_key, data_check_string) in hex.
 * 7. Timing-safe comparison of provided hash vs calculated hash.
 * 8. Verify auth_date is within acceptable age window and not in future.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  options: {
    maxAgeSeconds?: number;
    nowSeconds?: number;
  } = {}
): TelegramValidationResult {
  if (!initData || typeof initData !== 'string') {
    return { isValid: false, error: 'initData satri bo‘sh yoki kiritilmagan.' };
  }

  if (!botToken || typeof botToken !== 'string') {
    return { isValid: false, error: 'Serverda TELEGRAM_BOT_TOKEN sozlanmagan.' };
  }

  const maxAge = options.maxAgeSeconds ?? 86400; // 24 hours max
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  try {
    const params = new URLSearchParams(initData);
    const providedHash = params.get('hash');

    if (!providedHash) {
      return { isValid: false, error: 'initData tarkibida hash parametri topilmadi.' };
    }

    params.delete('hash');

    // Sort parameters alphabetically by key
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckArr: string[] = [];
    for (const key of sortedKeys) {
      dataCheckArr.push(`${key}=${params.get(key)}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // Generate secret key: HMAC_SHA256('WebAppData', botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate signature: HMAC_SHA256(secretKey, dataCheckString) in hex
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const provBuf = Buffer.from(providedHash, 'hex');

    if (calcBuf.length !== provBuf.length || !crypto.timingSafeEqual(calcBuf, provBuf)) {
      return { isValid: false, error: 'Telegram imzosi noto‘g‘ri (tampered or invalid hash).' };
    }

    // Check auth_date
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { isValid: false, error: 'initData tarkibida auth_date parametri topilmadi.' };
    }

    const authDate = Number(authDateStr);
    if (!Number.isFinite(authDate) || authDate <= 0) {
      return { isValid: false, error: 'auth_date parametri yaroqsiz son.' };
    }

    // Check if auth_date is too old (expired)
    if (now - authDate > maxAge) {
      return { isValid: false, error: 'Telegram autentifikatsiyasi muddati tugagan (auth_date expired).' };
    }

    // Check if auth_date is significantly in the future (> 60 seconds)
    if (authDate - now > 60) {
      return { isValid: false, error: 'auth_date kelajak vaqtiga to‘g‘ri kelmoqda (invalid future timestamp).' };
    }

    // Parse user object
    const userRaw = params.get('user');
    if (!userRaw) {
      return { isValid: false, error: 'initData tarkibida user ma‘lumotlari topilmadi.' };
    }

    let parsedUserObj: any;
    try {
      parsedUserObj = JSON.parse(userRaw);
    } catch {
      return { isValid: false, error: 'user parametri JSON formatida emas.' };
    }

    if (!parsedUserObj || typeof parsedUserObj.id === 'undefined') {
      return { isValid: false, error: 'user obyektida foydalanuvchi ID si mavjud emas.' };
    }

    const user: TelegramUser = {
      id: String(parsedUserObj.id),
      username: typeof parsedUserObj.username === 'string' ? parsedUserObj.username : undefined,
      firstName: typeof parsedUserObj.first_name === 'string' ? parsedUserObj.first_name : undefined,
      lastName: typeof parsedUserObj.last_name === 'string' ? parsedUserObj.last_name : undefined,
      languageCode: typeof parsedUserObj.language_code === 'string' ? parsedUserObj.language_code : undefined,
      isDemo: false,
    };

    return {
      isValid: true,
      user,
      authDate,
    };
  } catch (err: any) {
    return { isValid: false, error: `initData tekshirishda xatolik: ${err?.message}` };
  }
}

/**
 * Creates an HMAC-SHA256 signed session token for authenticated Telegram users.
 */
export function createSessionToken(
  user: TelegramUser,
  secret: string,
  expiresInSeconds: number = 7 * 86400 // 7 days
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const payload: SessionPayload = { user, iat, exp };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 */
export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds?: number
): TelegramUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Verify HMAC signature with timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: SessionPayload = JSON.parse(payloadStr);

    const now = nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    if (!payload.user || !payload.user.id) {
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

/**
 * Helper to construct an authentic Telegram initData string for automated testing.
 */
export function generateTestInitData(
  user: { id: number | string; first_name?: string; username?: string },
  botToken: string,
  options: {
    authDate?: number;
    tamperHash?: boolean;
    omitHash?: boolean;
    queryId?: string;
  } = {}
): string {
  const authDate = options.authDate ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();

  if (options.queryId) {
    params.set('query_id', options.queryId);
  }
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate));

  const sortedKeys = Array.from(params.keys()).sort();
  const dataCheckArr: string[] = [];
  for (const key of sortedKeys) {
    dataCheckArr.push(`${key}=${params.get(key)}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  let hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (options.tamperHash) {
    // Modify last hex character
    const lastChar = hash.slice(-1);
    const flippedChar = lastChar === 'a' ? 'b' : 'a';
    hash = hash.slice(0, -1) + flippedChar;
  }

  if (!options.omitHash) {
    params.set('hash', hash);
  }

  return params.toString();
}
