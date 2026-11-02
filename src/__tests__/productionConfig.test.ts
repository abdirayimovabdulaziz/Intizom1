process.env.NODE_ENV = 'test';

import assert from 'assert';
import { validateServerConfig, DEV_DEFAULT_SESSION_SECRET } from '../../server/config';
import { InMemoryUserStateRepository, SupabaseUserStateRepository } from '../../server/repository';
import { app } from '../../server';
import http from 'http';

console.log('--- Production Xavfsizlik & Konfiguratsiya Testlari ---');

// 1. Productionda SESSION_SECRET bo'lmaganda server ishga tushishi taqiqlanishi
{
  assert.throws(
    () => {
      validateServerConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: '',
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-secret-service-role-key-1234567890',
      });
    },
    /SESSION_SECRET sozlanmagan/,
    'Productionda bo‘sh SESSION_SECRET qat‘iy xato berishi kerak'
  );
  console.log('✅ PASS: 1) Productionda SESSION_SECRET yo‘q bo‘lsa server ishga tushishi to‘xtatildi');
}

// 2. Productionda SESSION_SECRET 32 belgidan qisqa bo'lsa rad etilishi
{
  assert.throws(
    () => {
      validateServerConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'short-secret-under-32-chars',
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-secret-service-role-key-1234567890',
      });
    },
    /kamida 32 ta belgi/,
    'Productionda 32 belgidan qisqa secret qabul qilinmasligi kerak'
  );
  console.log('✅ PASS: 2) Productionda 32 belgidan qisqa SESSION_SECRET rad etildi');
}

// 3. Koddagi standart dev secret productionda hech qachon qabul qilinmasligi
{
  assert.throws(
    () => {
      validateServerConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: DEV_DEFAULT_SESSION_SECRET,
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-secret-service-role-key-1234567890',
      });
    },
    /standart dev secret yoki namunaviy kalitlardan foydalanish qat‘iyan taqiqlanadi/,
    'Standart dev secret productionda bloklanishi kerak'
  );
  console.log('✅ PASS: 3) Standart dev secret production muhitida bloklandi');
}

// 4. Productionda TELEGRAM_BOT_TOKEN bo'lmaganda server to'xtashi
{
  assert.throws(
    () => {
      validateServerConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-very-strong-production-session-secret-64-bytes-long-random-string',
        TELEGRAM_BOT_TOKEN: '',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-secret-service-role-key-1234567890',
      });
    },
    /TELEGRAM_BOT_TOKEN sozlanmagan/,
    'Productionda bot token majburiy bo‘lishi kerak'
  );
  console.log('✅ PASS: 4) Productionda TELEGRAM_BOT_TOKEN yo‘qligi aniqlandi');
}

// 5. Productionda Supabase sozlamalari yo'q bo'lsa in-memory fallback taqiqlanishi
{
  assert.throws(
    () => {
      validateServerConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-very-strong-production-session-secret-64-bytes-long-random-string',
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      });
    },
    /In-Memory repository fallback taqiqlangan/,
    'Productionda in-memory fallback qat‘iyan taqiqlangan'
  );
  console.log('✅ PASS: 5) Productionda in-memory repository fallback qat‘iy bloklandi');
}

// 6. Productionda ALLOW_DEMO_AUTH=true bo'lsa ham demo rejim majburiy false bo'lishi
{
  const prodConfig = validateServerConfig({
    NODE_ENV: 'production',
    SESSION_SECRET: 'a-very-strong-production-session-secret-64-bytes-long-random-string',
    TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'valid-secret-service-role-key-1234567890',
    ALLOW_DEMO_AUTH: 'true',
  });

  assert.strictEqual(prodConfig.allowDemoAuth, false, 'Productionda demo rejim hech qachon yoqilmasligi shart');
  console.log('✅ PASS: 6) Productionda ALLOW_DEMO_AUTH=true bo‘lsa ham demo avtomatik o‘chirildi');
}

// 7. Preview demo ma'lumotlarining alohida izolyatsiyalanishi
{
  // SupabaseUserStateRepository ichida demo-preview-user saqlanganda
  // u real Supabase jadvaliga emas, alohida demoFallbackRepo ga yo'naltiriladi
  const supabaseRepo = new SupabaseUserStateRepository('https://example.supabase.co', 'dummy-key');
  
  const demoSnapshot = {
    tasks: [],
    habits: [],
    goals: [],
    expenses: [],
    activities: [],
  };

  // Demo user uchun get va save real tarmoq so'rovini bajarmasdan ichki xavfsiz xotiraga yo'naladi:
  const getDemo = await supabaseRepo.get('demo-preview-user');
  assert.strictEqual(getDemo, null);

  const saveDemo = await supabaseRepo.save('demo-preview-user', {
    expectedRevision: 0,
    operationId: 'op-demo-test',
    snapshot: demoSnapshot,
  });
  assert.strictEqual(saveDemo.status, 'saved');
  assert.strictEqual(saveDemo.record.userId, 'demo-preview-user');

  const afterDemo = await supabaseRepo.get('demo-preview-user');
  assert.strictEqual(afterDemo?.userId, 'demo-preview-user');
  console.log('✅ PASS: 7) Preview demo ma’lumotlari asosiy PostgreSQL bazasidan xavfsiz ajratildi');
}

// 8. RPC xatosi bo'lganda to'g'ridan-to'g'ri jadval yozuvi (.from) chaqirilmasligi va qat'iy xato otilishi
{
  const supabaseRepo = new SupabaseUserStateRepository('https://example.supabase.co', 'dummy-key');
  let fromCallCount = 0;
  let rpcCalledWith: any = null;

  const mockClient = {
    rpc: async (fnName: string, params: any) => {
      rpcCalledWith = { fnName, params };
      return {
        data: null,
        error: { message: 'function save_user_snapshot() permission denied or failed' },
      };
    },
    from: (_tableName: string) => {
      fromCallCount++;
      return {
        select: () => ({ single: async () => ({ data: null, error: null }) }),
        update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({}) }) }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({}) }) }),
      };
    },
  };

  (supabaseRepo as any).client = mockClient;

  let threw = false;
  try {
    await supabaseRepo.save('real-user-12345', {
      expectedRevision: 1,
      operationId: 'op-failure-test',
      snapshot: { tasks: [], habits: [], goals: [], expenses: [], activities: [] },
    });
  } catch (err: any) {
    threw = true;
    assert.match(err.message, /save_user_snapshot RPC xatosi/);
  }

  assert.strictEqual(threw, true, 'RPC xato berganda save() exception otishi shart');
  assert.strictEqual(fromCallCount, 0, 'RPC xato berganda to‘g‘ridan-to‘g‘ri jadvalga (.from) yozish fallback chaqirilmasligi shart');
  assert.strictEqual(rpcCalledWith.fnName, 'save_user_snapshot');
  console.log('✅ PASS: 8) RPC xato berganda to‘g‘ridan-to‘g‘ri jadval yozuvi chaqirilmadi, xato otildi');
}

// 9. Revision conflict holati RPC orqali to'g'ridan-to'g'ri qaytarilishi
{
  const supabaseRepo = new SupabaseUserStateRepository('https://example.supabase.co', 'dummy-key');
  let fromCallCount = 0;

  const mockClient = {
    rpc: async () => {
      return {
        data: {
          status: 'conflict',
          currentRevision: 5,
          serverRecord: {
            user_id: 'real-user-12345',
            telegram_username: 'real_user',
            telegram_first_name: 'Real User',
            schema_version: 1,
            revision: 5,
            last_operation_id: 'other-op',
            snapshot: { tasks: [], habits: [], goals: [], expenses: [], activities: [] },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        error: null,
      };
    },
    from: () => {
      fromCallCount++;
      return {};
    },
  };

  (supabaseRepo as any).client = mockClient;

  const result = await supabaseRepo.save('real-user-12345', {
    expectedRevision: 4,
    operationId: 'op-conflict-test',
    snapshot: { tasks: [], habits: [], goals: [], expenses: [], activities: [] },
  });

  assert.strictEqual(result.status, 'conflict');
  assert.strictEqual(result.currentRevision, 5);
  assert.strictEqual(fromCallCount, 0, 'Conflict paytida hech qanday to‘g‘ridan-to‘g‘ri table query chaqirilmasligi kerak');
  console.log('✅ PASS: 9) Revision conflict holati RPC orqali to‘g‘ridan-to‘g‘ri qaytarildi');
}

// 10. CSRF Himoyasi: X-Requested-With yoki Authorization headeri yo'q bo'lsa 403 rad etilishi
async function testCsrfProtection() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;

  try {
    // A) Header yo'q so'rov
    const resNoHeader = await fetch(`http://127.0.0.1:${port}/api/sync/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expectedRevision: 0, operationId: 'test', snapshot: {} }),
    });

    // Avval autentifikatsiya yoki CSRF to'xtatishi kerak
    assert.ok(
      resNoHeader.status === 401 || resNoHeader.status === 403,
      'CSRF yoki Auth headeri bo‘lmagan so‘rov rad etilishi kerak'
    );

    // B) Logout endpointida CSRF yo'qligi tekshirilishi
    const logoutNoCsrf = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(logoutNoCsrf.status, 403, 'CSRF headerisiz logout 403 qaytarishi shart');
    const data = await logoutNoCsrf.json();
    assert.strictEqual(data.code, 'CSRF_FAILED');
    console.log('✅ PASS: 10) CSRF himoyasi header bo‘lmagan so‘rovlarni muvaffaqiyatli to‘xtatdi');
  } finally {
    server.close();
  }
}

testCsrfProtection()
  .then(() => {
    console.log('\n========================================');
    console.log('Barcha Production Xavfsizlik testlari muvaffaqiyatli yakunlandi!');
    console.log('========================================\n');
  })
  .catch((err) => {
    console.error('Production testida xatolik:', err);
    process.exit(1);
  });
