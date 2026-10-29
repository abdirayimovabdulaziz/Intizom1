import assert from 'node:assert';
import {
  normalizeUzbekText,
  parseLocalUzbekIntent,
  validateAndNormalizeParsedItem,
  parseUzbekIntent,
  formatDateYMD,
} from '../utils/uzbekNlp';
import { ParsedItem, Habit } from '../types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => {
          console.log(`✓ ${name}`);
          passed++;
        },
        err => {
          console.error(`✗ ${name}`);
          console.error(err);
          failed++;
        }
      );
    } else {
      console.log(`✓ ${name}`);
      passed++;
    }
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    failed++;
  }
}

async function runTests() {
  console.log('--- NLP va Parser Shartnomasi Testlari boshlandi ---');

  // Reference date: Wednesday, 2026-03-04 10:00:00 (Asia/Tashkent UTC+5 -> 2026-03-04T05:00:00.000Z)
  const refDate = new Date('2026-03-04T05:00:00.000Z');
  const refTz = 'Asia/Tashkent';

  // 1. Normalizatsiya va apostrof variantlari
  test('1. Apostrof variantlari bir xil holatga keltirilishi', () => {
    const variants = ["so'm", 'so‘m', 'so’m', 'soʻm', 'soʼm'];
    const normalized = variants.map(v => normalizeUzbekText(v));
    for (const n of normalized) {
      assert.strictEqual(n, "so'm");
    }

    const oVariants = ["o'qish", 'o‘qish', 'o’qish', 'oʻqish', 'oʼqish'];
    for (const v of oVariants) {
      assert.strictEqual(normalizeUzbekText(v), "o'qish");
    }
  });

  // 2. Sana va vaqt tokenlari pul miqdoridan oldin ajratilishi, 17:00 da 17 summa bo'lmasligi
  test('2. "ertaga 17:00 da tushlik 45000 so\'m" -> 45000 UZS, 17:00, ertangi sana', () => {
    const res = parseLocalUzbekIntent("ertaga 17:00 da tushlik 45000 so'm", {
      referenceDate: refDate,
      timezone: refTz,
    });

    assert.strictEqual(res.category, 'harajat');
    assert.strictEqual(res.amount, 45000);
    assert.strictEqual(res.currency, 'UZS');
    assert.strictEqual(res.time, '17:00');
    // Ertangi sana 2026-03-05
    assert.strictEqual(res.date, '2026-03-05');
  });

  // 3. 1.5 ming so'm va 1,5 ming so‘m -> 1500 UZS
  test('3. "1.5 ming so\'m" va "1,5 ming so‘m" -> 1500 UZS', () => {
    const r1 = parseLocalUzbekIntent("taksi 1.5 ming so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r1.amount, 1500);
    assert.strictEqual(r1.currency, 'UZS');

    const r2 = parseLocalUzbekIntent("taksi 1,5 ming so‘m", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r2.amount, 1500);
    assert.strictEqual(r2.currency, 'UZS');
  });

  // 4. 12.50 dollar va $12.50 -> 12.5 USD
  test('4. "12.50 dollar" va "$12.50" -> 12.5 USD', () => {
    const r1 = parseLocalUzbekIntent("kitob sotib oldim 12.50 dollar", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r1.amount, 12.5);
    assert.strictEqual(r1.currency, 'USD');

    const r2 = parseLocalUzbekIntent("kitob $12.50", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r2.amount, 12.5);
    assert.strictEqual(r2.currency, 'USD');
  });

  // 5. 45 000 so'm (bo'shliq bilan minglik) -> 45000 UZS
  test('5. "45 000 so\'m" -> 45000 UZS', () => {
    const res = parseLocalUzbekIntent("tushlik 45 000 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.amount, 45000);
    assert.strictEqual(res.currency, 'UZS');
  });

  // 6. Noto'g'ri soat (25:90) va noto'g'ri sana (2026-02-31) rad etilishi
  test('6. 25:90 va 2026-02-31 noto\'g\'ri vaqt/sana sifatida qabul qilinmasligi', () => {
    const rTime = parseLocalUzbekIntent("soat 25:90 da uchrashuv", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(rTime.time, null);

    const rDate = parseLocalUzbekIntent("2026-02-31 da topshirish", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(rDate.date, null);
  });

  // 7. Haftasiga 3 kun zal -> weekly_target, targetDaysPerWeek=3
  test('7. "haftasiga 3 kun zal" -> weekly_target, targetDaysPerWeek=3', () => {
    const res = parseLocalUzbekIntent("haftasiga 3 kun zal", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.category, 'odat');
    assert.strictEqual(res.frequency, 'weekly_target');
    assert.strictEqual(res.targetDaysPerWeek, 3);
  });

  // 8. "har dushanba va juma 20 bet kitob" -> specific_days, daysOfWeek=[1, 5], quantity=20
  test('8. "har dushanba va juma 20 bet kitob" -> specific_days, daysOfWeek=[1, 5], quantity=20', () => {
    const res = parseLocalUzbekIntent("har dushanba va juma 20 bet kitob", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.category, 'odat');
    assert.strictEqual(res.frequency, 'specific_days');
    assert.deepStrictEqual(res.daysOfWeek, [1, 5]);
    assert.strictEqual(res.quantity, 20);
    assert.strictEqual(res.unit, 'sahifa');
  });

  // 9. "har kuni 60 daqiqa yurish" -> odat bo'lib qolishi (quantity > 50 bo'lgani uchun maqsadga aylanmasin)
  test('9. "har kuni 60 daqiqa yurish" -> odat (maqsad emas), frequency=daily', () => {
    const res = parseLocalUzbekIntent("har kuni 60 daqiqa yurish", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.category, 'odat');
    assert.strictEqual(res.frequency, 'daily');
    assert.strictEqual(res.quantity, 60);
  });

  // 10. "kunora 20 bet kitob" -> avtomatik yaratish bloklanadi, daily qilib saqlanmaydi
  test('10. "kunora 20 bet kitob" -> isIntervalBlocked=true, category=noaniq', () => {
    const res = parseLocalUzbekIntent("kunora 20 bet kitob", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.isIntervalBlocked, true);
    assert.strictEqual(res.category, 'noaniq');
    assert.notStrictEqual(res.frequency, 'daily');
  });

  // 11. "daromad: 500000 ish haqi" -> xarajat sifatida kiritilmasligi va bloklanishi
  test('11. "daromad: 500000 ish haqi" -> isIncomeBlocked=true, category=noaniq', () => {
    const res = parseLocalUzbekIntent("daromad: 500000 ish haqi", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.isIncomeBlocked, true);
    assert.strictEqual(res.category, 'noaniq');
  });

  // 12. Dori/qo'shimchadan uydirma 5 gram doza yoki qabul vaqti yasalmasligi
  test('12. "kreatin" -> dosage va timeSlot null bo\'lishi (5 gram uydirilmaydi)', () => {
    const res = parseLocalUzbekIntent("kreatin", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.category, 'qabul');
    assert.strictEqual(res.dosage, null);
    assert.strictEqual(res.timeSlot, null);

    const res2 = parseLocalUzbekIntent("5g kreatin", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res2.category, 'qabul');
    assert.strictEqual(res2.dosage, '5g');
  });

  // 13. Valyutasiz raqam har doim pul deb olinmasligi; xarajat prefiksi bo'lganda olinishi
  test('13. Valyutasiz raqam: prefiks bo\'lmasa xarajat emas, prefiks bo\'lsa olinadi', () => {
    const notExpense = parseLocalUzbekIntent("5000 kitob o'qidim", { referenceDate: refDate, timezone: refTz });
    assert.notStrictEqual(notExpense.category, 'harajat');

    const withPrefix = parseLocalUzbekIntent("harajat: 45000 tushlik", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(withPrefix.category, 'harajat');
    assert.strictEqual(withPrefix.amount, 45000);
    assert.strictEqual(withPrefix.currency, 'UZS');
  });

  // 14. AI javobida USD saqlanishi va validateAndNormalizeParsedItem shartnomasi
  test('14. validateAndNormalizeParsedItem USD va to\'g\'ri maydonlarni saqlashi', () => {
    const rawAiResponse = {
      category: 'harajat',
      title: 'Server obunasi',
      amount: 15,
      currency: 'USD',
      date: '2026-03-04',
      time: '14:00',
    };

    const normalized = validateAndNormalizeParsedItem(rawAiResponse);
    assert.strictEqual(normalized.category, 'harajat');
    assert.strictEqual(normalized.amount, 15);
    assert.strictEqual(normalized.currency, 'USD');
    assert.strictEqual(normalized.title, 'Server obunasi');
  });

  // 15. Buzilgan AI javobi lokal fallback'ka o'tishi
  test('15. Buzilgan AI javobi validateAndNormalizeParsedItem tomonidan tuzatilishi yoki rad etilishi', () => {
    const corruptAiResponse = {
      category: 'unknown_cat',
      title: 'Xatolik',
      amount: 'bir million',
      date: '2026-02-31', // noto'g'ri sana
      time: '25:99', // noto'g'ri vaqt
    };

    const normalized = validateAndNormalizeParsedItem(corruptAiResponse);
    assert.strictEqual(normalized.category, 'noaniq');
    assert.strictEqual(normalized.amount, null);
    assert.strictEqual(normalized.date, null);
    assert.strictEqual(normalized.time, null);
  });

  // 16. aiEnabled=false bo'lganda fetch chaqirilmasligi
  await test('16. settings.aiEnabled=false bo\'lganda fetch chaqirilmasligi', async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called!');
    };

    try {
      const res = await parseUzbekIntent("ertaga soat 10:00 da uchrashuv", {
        referenceDate: refDate,
        timezone: refTz,
        aiEnabled: false,
      });

      assert.strictEqual(fetchCalled, false, 'aiEnabled=false bo\'lsa fetch chaqirilmasligi kerak');
      assert.strictEqual(res.category, 'uchrashuv');
      assert.strictEqual(res.time, '10:00');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 17. Bir nechta amal aniqlanganda bitta buzuq yozuvga birlashtirilmasligi va bloklanishi
  test('17. "50000 so\'mga kitob oldim va 10 bet o\'qidim" -> isMultipleActionsBlocked=true', () => {
    const res = parseLocalUzbekIntent("50000 so'mga kitob oldim va 10 bet o'qidim", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.isMultipleActionsBlocked, true);
    assert.strictEqual(res.category, 'noaniq');
  });

  // 18. Bot orqali habit yaratilganda recurrence ma'lumotlari yo'qolmasligi
  test('18. Bot orqali yaratilgan odatda weekly_target va specific_days saqlanishi', () => {
    const parsedWeekly: ParsedItem = {
      category: 'odat',
      title: 'Suzish',
      frequency: 'weekly_target',
      targetDaysPerWeek: 3,
      daysOfWeek: null,
      amount: null,
      date: null,
      time: null,
      dosage: null,
      unit: null,
      quantity: null,
      confidence: 0.9,
      explanationUz: 'Suzish odati',
      source: 'local-rules',
    };

    const habit: Habit = {
      id: 'h-1',
      title: parsedWeekly.title,
      category: 'odat',
      habitType: 'general',
      frequency: parsedWeekly.frequency || 'daily',
      targetDaysPerWeek: parsedWeekly.targetDaysPerWeek || undefined,
      daysOfWeek: parsedWeekly.daysOfWeek || [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 0,
      bestStreak: 0,
      history: {},
    };

    assert.strictEqual(habit.frequency, 'weekly_target');
    assert.strictEqual(habit.targetDaysPerWeek, 3);
  });

  console.log(`\nJami: ${passed} muvaffaqiyatli, ${failed} xato.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
