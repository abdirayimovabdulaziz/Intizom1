import assert from 'assert';
import {
  validateTelegramInitData,
  createSessionToken,
  verifySessionToken,
  generateTestInitData,
} from '../../server/telegramAuth';

console.log('--- Telegram WebApp Autentifikatsiyasi Testlari ---');

const TEST_BOT_TOKEN = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ_test_token';
const TEST_SESSION_SECRET = 'super-secret-session-key-32-chars-long!';

// 1. Haqiqiy algoritm bilan imzolangan test initData qabul qilinishi
{
  const now = Math.floor(Date.now() / 1000);
  const user = { id: 987654321, first_name: 'Abdulaziz', username: 'abdulaziz_dev' };
  const initData = generateTestInitData(user, TEST_BOT_TOKEN, { authDate: now });

  const result = validateTelegramInitData(initData, TEST_BOT_TOKEN, { nowSeconds: now });
  assert.strictEqual(result.isValid, true, 'Haqiqiy imzolangan initData qabul qilinishi kerak');
  assert.strictEqual(result.user?.id, '987654321', 'Foydalanuvchi ID si to‘g‘ri o‘qilishi kerak');
  assert.strictEqual(result.user?.username, 'abdulaziz_dev');
  assert.strictEqual(result.user?.firstName, 'Abdulaziz');
  console.log('✅ PASS: 1) Haqiqiy algoritm bilan imzolangan test initData qabul qilindi');
}

// 2. Buzilgan imzo (tampered hash) rad etilishi
{
  const now = Math.floor(Date.now() / 1000);
  const user = { id: 987654321, first_name: 'Abdulaziz' };
  const tamperedInitData = generateTestInitData(user, TEST_BOT_TOKEN, {
    authDate: now,
    tamperHash: true,
  });

  const result = validateTelegramInitData(tamperedInitData, TEST_BOT_TOKEN, { nowSeconds: now });
  assert.strictEqual(result.isValid, false, 'Buzilgan imzo rad etilishi shart');
  assert.ok(result.error?.includes('noto‘g‘ri'), 'Aniqlangan xatolik xabari qaytarilishi kerak');
  console.log('✅ PASS: 2) Buzilgan imzo (tampered hash) rad etildi');
}

// 3. Eskirgan auth_date (> 24 soat) rad etilishi
{
  const now = Math.floor(Date.now() / 1000);
  const staleAuthDate = now - 90000; // ~25 hours ago
  const user = { id: 987654321, first_name: 'Abdulaziz' };
  const staleInitData = generateTestInitData(user, TEST_BOT_TOKEN, { authDate: staleAuthDate });

  const result = validateTelegramInitData(staleInitData, TEST_BOT_TOKEN, { nowSeconds: now });
  assert.strictEqual(result.isValid, false, 'Eskirgan auth_date rad etilishi shart');
  assert.ok(result.error?.includes('muddati tugagan'), 'auth_date muddati xabari bo‘lishi kerak');
  console.log('✅ PASS: 3) Eskirgan auth_date rad etildi');
}

// 4. Kelajak sanasidagi auth_date rad etilishi
{
  const now = Math.floor(Date.now() / 1000);
  const futureAuthDate = now + 10000;
  const user = { id: 987654321, first_name: 'Abdulaziz' };
  const futureInitData = generateTestInitData(user, TEST_BOT_TOKEN, { authDate: futureAuthDate });

  const result = validateTelegramInitData(futureInitData, TEST_BOT_TOKEN, { nowSeconds: now });
  assert.strictEqual(result.isValid, false, 'Kelajak auth_date rad etilishi shart');
  assert.ok(result.error?.includes('kelajak vaqtiga'), 'Kelajak xatosi qaytarilishi kerak');
  console.log('✅ PASS: 4) Kelajak sanasidagi auth_date rad etildi');
}

// 5. Imzosiz (hash yo'q) initData rad etilishi
{
  const now = Math.floor(Date.now() / 1000);
  const user = { id: 987654321 };
  const noHashInitData = generateTestInitData(user, TEST_BOT_TOKEN, { authDate: now, omitHash: true });

  const result = validateTelegramInitData(noHashInitData, TEST_BOT_TOKEN, { nowSeconds: now });
  assert.strictEqual(result.isValid, false, 'Hash bo‘lmaganda rad etilishi kerak');
  console.log('✅ PASS: 5) Hash bo‘lmagan so‘rov rad etildi');
}

// 6. Sessiya tokenini yaratish va tekshirish
{
  const user = { id: 'user_456', username: 'tester', firstName: 'Ali', isDemo: false };
  const token = createSessionToken(user, TEST_SESSION_SECRET, 3600);
  assert.ok(token.includes('.'), 'Token formatida nuqta bilan ajratilgan imzo bo‘lishi kerak');

  const verified = verifySessionToken(token, TEST_SESSION_SECRET);
  assert.ok(verified, 'Sessiya tokeni tekshiruvdan o‘tishi kerak');
  assert.strictEqual(verified.id, 'user_456');
  assert.strictEqual(verified.username, 'tester');
  console.log('✅ PASS: 6) Sessiya tokeni yaratildi va tekshirildi');
}

// 7. Sessiya tokeni imzosining buzilishi rad etilishi
{
  const user = { id: 'user_456', username: 'tester', firstName: 'Ali', isDemo: false };
  const token = createSessionToken(user, TEST_SESSION_SECRET, 3600);
  const tamperedToken = token + 'xyz';

  const verified = verifySessionToken(tamperedToken, TEST_SESSION_SECRET);
  assert.strictEqual(verified, null, 'Buzilgan sessiya tokeni rad etilishi kerak');
  console.log('✅ PASS: 7) Buzilgan sessiya tokeni rad etildi');
}

// 8. Noto‘g‘ri maxfiy kalit bilan tekshirish rad etilishi
{
  const user = { id: 'user_456', username: 'tester', firstName: 'Ali', isDemo: false };
  const token = createSessionToken(user, TEST_SESSION_SECRET, 3600);

  const verified = verifySessionToken(token, 'wrong-secret-key');
  assert.strictEqual(verified, null, 'Noto‘g‘ri secret bilan token rad etilishi kerak');
  console.log('✅ PASS: 8) Noto‘g‘ri server secret bilan tekshirish rad etildi');
}

console.log('Barcha Telegram Autentifikatsiya testlari muvaffaqiyatli yakunlandi!\n');
