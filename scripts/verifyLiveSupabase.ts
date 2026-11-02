import assert from 'assert';
import dotenv from 'dotenv';
import { SupabaseUserStateRepository } from '../server/repository';

dotenv.config();

async function runLiveVerification() {
  console.log('======================================================');
  console.log('JONLI SUPABASE POSTGRESQL INTEGRATSIYA TEKSHIRUVI');
  console.log('======================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY muhitda mavjud emas!');
  }

  // DIQQAT: Xavfsizlik talabiga binoan maxfiy kalitlar va to'liq URL logga chiqarilmaydi
  const urlDomain = new URL(supabaseUrl).hostname;
  console.log(`[1] Supabase xosti aniqlandi: ${urlDomain} (kalit uzunligi: ${serviceRoleKey.length} bayt)`);

  const repo = new SupabaseUserStateRepository(supabaseUrl, serviceRoleKey);
  const client = (repo as any).client;

  // 1. user_snapshots jadvalini server orqali o'qish mumkinligini tekshirish
  console.log('\n[2] user_snapshots jadvalini SELECT so‘rovi bilan tekshirish...');
  const { data: readCheck, error: readError } = await client
    .from('user_snapshots')
    .select('user_id, revision, updated_at')
    .limit(1);

  if (readError) {
    throw new Error(`user_snapshots jadvalini o‘qishda xatolik: ${readError.message} (kod: ${readError.code})`);
  }
  console.log(`✅ user_snapshots jadvali server orqali muvaffaqiyatli o‘qildi (jadvaldagi namunaviy yozuvlar soni: ${readCheck?.length ?? 0}).`);

  // 2. Alohida vaqt tamg‘ali test foydalanuvchisi yaratish (mavjud ma'lumotlarga ziyon yetkazmaslik uchun)
  const testUserId = `live_test_user_${Date.now()}`;
  console.log(`\n[3] Alohida test foydalanuvchisi aniqlandi: ${testUserId}`);

  const testSnapshotV1 = {
    tasks: [
      {
        id: 't-test-1',
        title: 'Jonli baza test vazifasi',
        category: 'vazifa',
        date: '2026-11-02',
        status: 'pending',
        priority: 'high',
        source: 'miniapp',
      },
    ],
    habits: [],
    goals: [],
    expenses: [],
    activities: [],
    settings: {
      name: 'Jonli Test',
      username: 'live_test_bot',
      timezone: 'Asia/Tashkent',
      morningTime: '08:00',
      eveningTime: '21:00',
      reminderSound: true,
      aiEnabled: true,
    },
  };

  try {
    // 3. save_user_snapshot RPC orqali dastlabki holatni saqlash (expectedRevision: 0)
    console.log('[4] save_user_snapshot RPC orqali dastlabki saqlash (revision 1)...');
    const saveResult1 = await repo.save(testUserId, {
      expectedRevision: 0,
      operationId: 'op_live_test_001',
      snapshot: testSnapshotV1 as any,
      schemaVersion: 1,
      username: 'live_tester',
      firstName: 'Jonli Tekshiruvchi',
    });

    assert.strictEqual(saveResult1.status, 'saved', 'Dastlabki saqlash statusi "saved" bo‘lishi kerak');
    assert.strictEqual(saveResult1.record.revision, 1, 'Dastlabki reviziya 1 bo‘lishi kerak');
    assert.strictEqual(saveResult1.record.userId, testUserId, 'User ID to‘g‘ri bo‘lishi kerak');
    assert.strictEqual(saveResult1.record.lastOperationId, 'op_live_test_001', 'lastOperationId to‘g‘ri saqlanishi kerak');
    console.log('✅ Dastlabki saqlash muvaffaqiyatli: revision 1, status: "saved".');

    // 4. Server orqali qayta o'qish (repo.get)
    console.log('[5] Saqlangan test yozuvini server orqali qayta o‘qish...');
    const fetched = await repo.get(testUserId);
    assert.ok(fetched !== null, 'Saqlangan test yozuvi bazada mavjud bo‘lishi kerak');
    assert.strictEqual(fetched.userId, testUserId);
    assert.strictEqual(fetched.revision, 1);
    assert.strictEqual(fetched.lastOperationId, 'op_live_test_001');
    assert.strictEqual((fetched.snapshot as any).tasks?.[0]?.title, 'Jonli baza test vazifasi');
    console.log('✅ Qayta o‘qish muvaffaqiyatli: ma’lumotlar bazada to‘liq va bus-butun saqlangan.');

    // 5. Idempotent replay tekshiruvi (bir xil operationId bilan qayta chaqirish)
    console.log('[6] Idempotent takroriy so‘rov (idempotent replay) sinovi...');
    const replayResult = await repo.save(testUserId, {
      expectedRevision: 0, // eski revision yuborilgan taqdirda ham
      operationId: 'op_live_test_001', // ayni bir xil operationId
      snapshot: testSnapshotV1 as any,
      schemaVersion: 1,
    });
    assert.strictEqual(replayResult.status, 'idempotent_replay', 'Takroriy operatsiyada idempotent_replay statusi qaytishi shart');
    assert.strictEqual(replayResult.isIdempotentReplay, true);
    assert.strictEqual(replayResult.record.revision, 1, 'Reviziya takroriy so‘rovda oshmasligi kerak');
    console.log('✅ Idempotent replay muvaffaqiyatli: reviziya oshmadi, idempotent_replay qaytarildi.');

    // 6. Revision conflict tekshiruvi (eskirgan expectedRevision va yangi operationId)
    console.log('[7] Revision conflict (ziddiyat) tekshiruvi...');
    const conflictResult = await repo.save(testUserId, {
      expectedRevision: 0, // bazadagi 1 ga teng emas
      operationId: 'op_live_test_002_conflict',
      snapshot: testSnapshotV1 as any,
      schemaVersion: 1,
    });
    assert.strictEqual(conflictResult.status, 'conflict', 'Reviziya mos kelmaganda conflict statusi qaytishi kerak');
    assert.strictEqual(conflictResult.currentRevision, 1, 'Serverdagi joriy reviziya 1 bo‘lishi kerak');
    assert.ok(conflictResult.serverRecord !== null, 'Serverdagi so‘nggi yozuv qaytarilishi kerak');
    console.log('✅ Revision conflict muvaffaqiyatli: status "conflict", currentRevision: 1.');

    // 7. To'g'ri yangilash (expectedRevision: 1 -> revision 2)
    console.log('[8] Yangi reviziyani to‘g‘ri saqlash (expectedRevision: 1 -> revision 2)...');
    const updateResult = await repo.save(testUserId, {
      expectedRevision: 1,
      operationId: 'op_live_test_003_valid',
      snapshot: {
        ...testSnapshotV1,
        tasks: [{ ...testSnapshotV1.tasks[0], status: 'completed' }],
      } as any,
      schemaVersion: 1,
    });
    assert.strictEqual(updateResult.status, 'saved');
    assert.strictEqual(updateResult.record.revision, 2, 'Reviziya 2 ga oshishi kerak');
    assert.strictEqual(updateResult.record.lastOperationId, 'op_live_test_003_valid');
    console.log('✅ Yangi reviziyani saqlash muvaffaqiyatli: revision 2.');

  } finally {
    // 8. Faqat o'zimiz yaratgan test yozuvini tozalash (boshqa yozuvlarga tegmasdan)
    console.log(`\n[9] Faqat yaratilgan test yozuvini tozalash (${testUserId})...`);
    const { error: deleteError } = await client
      .from('user_snapshots')
      .delete()
      .eq('user_id', testUserId);

    if (deleteError) {
      console.error('⚠️ Test yozuvini o‘chirishda xatolik:', deleteError.message);
    } else {
      const verifyDeleted = await repo.get(testUserId);
      assert.strictEqual(verifyDeleted, null, 'Test yozuvi bazadan to‘liq o‘chirilgan bo‘lishi shart');
      console.log('✅ Test yozuvi muvaffaqiyatli tozalandi (user_id o‘chirildi va get null qaytardi).');
      console.log('✅ Boshqa hech qanday foydalanuvchi ma’lumotlariga tegilmadi.');
    }
  }

  console.log('\n======================================================');
  console.log('HAMMA JONLI SUPABASE TEKSHIRUVLARI 100% MUVAFFAQIYATLI O‘TDI!');
  console.log('======================================================\n');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ Jonli Supabase tekshiruvida xatolik yuz berdi:', err?.message || err);
  process.exit(1);
});
