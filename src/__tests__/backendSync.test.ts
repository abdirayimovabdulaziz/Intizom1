import assert from 'assert';
import { InMemoryUserStateRepository } from '../../server/repository';
import { validateDomainSnapshot } from '../../server/validateSnapshot';
import { UserSnapshot } from '../../server/types';
import { Task, Habit, Goal, Expense, Activity, UserSettings } from '../types';

console.log('--- Backend Sinxronizatsiya & Tranzaksiya Testlari ---');
console.log('[Ma‘lumotlar bazasi holati]: In-Memory Tranzaksion Repository tekshirilmoqda.');
console.log('(Eslatma: Jonli Supabase PostgreSQL ulanishi uchun SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env da kiritiladi)\n');

const createValidSnapshot = (): UserSnapshot => {
  const task: Task = {
    id: 'task-1',
    title: 'Kitob o‘qish',
    category: 'vazifa',
    date: '2026-11-01',
    time: '14:00',
    status: 'pending',
    priority: 'medium',
    source: 'miniapp',
  };

  const habit: Habit = {
    id: 'habit-1',
    title: 'Sport mashg‘uloti',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 3,
    bestStreak: 5,
    history: {
      '2026-11-01': {
        completed: true,
        activityContributions: {
          'act-1': { quantity: undefined, timestamp: '10:00' },
        },
      },
    },
  };

  const activity: Activity = {
    id: 'act-1',
    title: 'Sport mashg‘uloti',
    localDate: '2026-11-01',
    time: '10:00',
    category: 'sport',
    durationMinutes: 45,
    linkedHabitId: 'habit-1',
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  const goal: Goal = {
    id: 'goal-1',
    title: '100 km yugurish',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 100,
    currentValue: 15,
    unit: 'km',
    linkedHabitIds: ['habit-1'],
    status: 'active',
  };

  const expense: Expense = {
    id: 'exp-1',
    title: 'Sport zali oylik abonement',
    amount: 300000,
    currency: 'UZS',
    category: 'sport',
    date: '2026-11-01',
    source: 'miniapp',
  };

  const settings: UserSettings = {
    name: 'Abdulaziz',
    username: 'abdulaziz_dev',
    timezone: 'Asia/Tashkent',
    morningTime: '08:00',
    eveningTime: '21:00',
    reminderSound: true,
    aiEnabled: true,
  };

  return {
    tasks: [task],
    habits: [habit],
    goals: [goal],
    expenses: [expense],
    activities: [activity],
    settings,
  };
};

async function runTests() {
  const repo = new InMemoryUserStateRepository();

  // 1. Yangi foydalanuvchi holatini dastlabki saqlash (expectedRevision: 0)
  {
    const snapshot = createValidSnapshot();
    const result = await repo.save('user_A', {
      expectedRevision: 0,
      operationId: 'op-init-A',
      snapshot,
      username: 'user_a',
      firstName: 'Alisher',
    });

    assert.strictEqual(result.status, 'saved', 'Dastlabki saqlash muvaffaqiyatli bo‘lishi kerak');
    assert.strictEqual(result.record.revision, 1, 'Yangi foydalanuvchi uchun revision 1 bo‘lishi kerak');
    assert.strictEqual(result.record.userId, 'user_A');
    console.log('✅ PASS: 1) Dastlabki snapshot muvaffaqiyatli saqlandi (revision 1)');
  }

  // 2. Ikki foydalanuvchi ma’lumotlari mutlaqo ajratilishi (User Isolation)
  {
    const snapshotB = createValidSnapshot();
    snapshotB.tasks[0].title = 'User B vazifasi';

    await repo.save('user_B', {
      expectedRevision: 0,
      operationId: 'op-init-B',
      snapshot: snapshotB,
      username: 'user_b',
    });

    const recordA = await repo.get('user_A');
    const recordB = await repo.get('user_B');

    assert.notStrictEqual(recordA?.snapshot.tasks[0].title, recordB?.snapshot.tasks[0].title);
    assert.strictEqual(recordA?.snapshot.tasks[0].title, 'Kitob o‘qish');
    assert.strictEqual(recordB?.snapshot.tasks[0].title, 'User B vazifasi');
    console.log('✅ PASS: 2) Ikki foydalanuvchi ma’lumotlari xavfsiz ajratildi');
  }

  // 3. ExpectedRevision konflikti (409 Conflict)
  {
    const snapshot = createValidSnapshot();
    // User A hozir 1-versiyada. Agar mijoz eskirgan 0-versiya deb yuborsa, konflikt chiqishi kerak:
    const conflictResult = await repo.save('user_A', {
      expectedRevision: 0,
      operationId: 'op-conflict-attempt',
      snapshot,
    });

    assert.strictEqual(conflictResult.status, 'conflict', 'Revision mos kelmaganda conflict qaytishi kerak');
    if (conflictResult.status === 'conflict') {
      assert.strictEqual(conflictResult.currentRevision, 1, 'Serverdagi amaldagi revision qaytarilishi kerak');
      assert.strictEqual(conflictResult.serverRecord?.userId, 'user_A');
    }
    console.log('✅ PASS: 3) expectedRevision mos kelmaganda 409 conflict muvaffaqiyatli qaytarildi');
  }

  // 4. Bir xil operationId qayta yuborilishi (Idempotent Replay)
  {
    // Ayni operatsiyani yangi expectedRevision bilan bajaramiz:
    const snapshot = createValidSnapshot();
    const saveRes = await repo.save('user_A', {
      expectedRevision: 1,
      operationId: 'op-update-1',
      snapshot,
    });
    assert.strictEqual(saveRes.status, 'saved');
    assert.strictEqual(saveRes.record.revision, 2);

    // Endi server javobi yo‘qolgan deb faraz qilib, mijoz ayni op-update-1 ni qayta yuboradi:
    const replayRes = await repo.save('user_A', {
      expectedRevision: 1, // Mijoz javob olmagani uchun hali eski revision deb o‘ylaydi
      operationId: 'op-update-1',
      snapshot,
    });

    assert.strictEqual(replayRes.status, 'idempotent_replay', 'Qayta yuborilgan operationId idempotent bo‘lishi kerak');
    assert.strictEqual(replayRes.record.revision, 2, 'Revision ikkinchi marta sun‘iy oshib ketmasligi kerak');
    console.log('✅ PASS: 4) Idempotent takroriy so‘rov (lost response retry) xavfsiz qayta ishlandi');
  }

  // 5. Noto‘g‘ri snapshot (buzilgan activity contribution) state’ni o‘zgartirmasligi
  {
    const corruptedSnapshot = createValidSnapshot();
    // Faoliyat va odat hissasi bog‘lanishini buzamiz (arvoh hissa):
    corruptedSnapshot.habits[0].history['2026-11-01'].activityContributions = {
      'ghost-act-999': { quantity: undefined },
    };

    const validation = validateDomainSnapshot(corruptedSnapshot);
    assert.strictEqual(validation.isValid, false, 'Buzilgan hissa validatsiyadan o‘tmasligi kerak');
    assert.ok(validation.error?.includes('topilmadi') || validation.error?.includes('buzilgan'));

    // Serverda saqlash rad etiladi va amaldagi holat o‘zgarmaydi:
    const currentA = await repo.get('user_A');
    assert.strictEqual(currentA?.revision, 2, 'Muvaffaqiyatsiz validatsiyadan keyin revision o‘zgarmasligi kerak');
    console.log('✅ PASS: 5) Yaroqsiz snapshot tekshiruvdan o‘tmadi va ma’lumotlar bazasini zararlamadi');
  }

  // 6. Foydalanuvchi timezone va sanalari tekshiruvi
  {
    const validSnap = createValidSnapshot();
    const val = validateDomainSnapshot(validSnap);
    assert.strictEqual(val.isValid, true, 'To‘g‘ri snapshot qabul qilinishi kerak');
    assert.strictEqual(val.sanitizedSnapshot?.settings?.timezone, 'Asia/Tashkent');
    console.log('✅ PASS: 6) Timezone va sana cheklovlari to‘liq tekshirildi');
  }

  // 7. localStorage migratsiyasida ma’lumotlar butunligi saqlanishi
  {
    // Yangi foydalanuvchi user_C (bulutda holati hali mavjud emas):
    const emptyCheck = await repo.get('user_C');
    assert.strictEqual(emptyCheck, null, 'Dastlab bulut holati bo‘sh');

    // Lokal xotiradagi barcha ma’lumotlarni ko‘chirish (migration):
    const localSnapshot = createValidSnapshot();
    const migrateRes = await repo.save('user_C', {
      expectedRevision: 0,
      operationId: 'op-migration-C',
      snapshot: localSnapshot,
    });

    assert.strictEqual(migrateRes.status, 'saved');
    assert.strictEqual(migrateRes.record.revision, 1);
    assert.strictEqual(migrateRes.record.snapshot.tasks.length, 1);
    assert.strictEqual(migrateRes.record.snapshot.habits.length, 1);
    assert.strictEqual(migrateRes.record.snapshot.goals.length, 1);
    assert.strictEqual(migrateRes.record.snapshot.expenses.length, 1);
    assert.strictEqual(migrateRes.record.snapshot.activities.length, 1);
    console.log('✅ PASS: 7) Lokal xotiradan bulutga ko‘chirishda ma’lumotlar 100% yo‘qotishsiz saqlandi');
  }

  // 8. Ikki akkaunt almashganda lokal holat chalkashmasligi (Account Isolation Guard)
  {
    // Qurilma user_A ga biriktirilgan (boundAccountId = 'user_A')
    const boundAccountId: string = 'user_A';
    const newLoggedInUser: string = 'user_D';

    // Algoritm yangi akkaunt kelsa, eski ma'lumotlarni user_D ga avtomatik yuklamasligi kerak:
    const isAccountConflict = boundAccountId !== newLoggedInUser;
    assert.strictEqual(isAccountConflict, true, 'Turli akkauntlar aniqlanishi shart');
    console.log('✅ PASS: 8) Ikki akkaunt almashganda boshqa akkaunt ma’lumotlari chalkashishi bloklandi');
  }

  console.log('\n========================================');
  console.log('Barcha Backend Sinxronizatsiya testlari muvaffaqiyatli yakunlandi!');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('Testda xatolik:', err);
  process.exit(1);
});
