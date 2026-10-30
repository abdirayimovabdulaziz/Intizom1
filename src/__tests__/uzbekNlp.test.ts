import assert from 'node:assert';
import {
  normalizeUzbekText,
  parseLocalUzbekIntent,
  validateParsedItemContract,
  validateAndNormalizeParsedItem,
  parseUzbekIntent,
  formatDateYMD,
  buildHabitCreatePayload,
  buildExpenseCreatePayload,
  buildTaskCreatePayload,
  processEntityCreationFromParsed,
} from '../utils/uzbekNlp';
import { ParsedItem } from '../types';

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
  console.log('--- NLP va Parser Shartnomasi Testlari (2-bosqich chuqur tekshiruv) ---');

  // Reference date: Wednesday, 2026-03-04 10:00:00 in Tashkent (UTC: 2026-03-04T05:00:00.000Z)
  const refDate = new Date('2026-03-04T05:00:00.000Z');
  const refTz = 'Asia/Tashkent';

  // 1. Normalizatsiya va apostrof variantlari
  test('1. Apostrof variantlari bir xil holatga keltirilishi', () => {
    const variants = ["so'm", 'so‘m', 'so’m', 'soʻm', 'soʼm'];
    for (const v of variants) {
      assert.strictEqual(normalizeUzbekText(v), "so'm");
    }
  });

  // 2. Sana va vaqt tokenlari pul miqdoridan oldin ajratilishi (17:00 da 17 summa bo'lmasligi)
  test('2. "ertaga 17:00 da tushlik 45000 so\'m" -> 45000 UZS, 17:00, ertangi sana', () => {
    const res = parseLocalUzbekIntent("ertaga 17:00 da tushlik 45000 so'm", {
      referenceDate: refDate,
      timezone: refTz,
    });
    assert.strictEqual(res.category, 'harajat');
    assert.strictEqual(res.amount, 45000);
    assert.strictEqual(res.currency, 'UZS');
    assert.strictEqual(res.time, '17:00');
    assert.strictEqual(res.date, '2026-03-05');
  });

  // 3. Pul tokenlari siyosati: 45.000 so'm, 45,000 so'm, 1.234,56 so'm, 1400$
  test('3. "45.000 so\'m" -> 45000 UZS', () => {
    const res = parseLocalUzbekIntent("tushlik 45.000 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.amount, 45000);
    assert.strictEqual(res.currency, 'UZS');
  });

  test('3. "45,000 so\'m" -> 45000 UZS', () => {
    const res = parseLocalUzbekIntent("tushlik 45,000 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.amount, 45000);
    assert.strictEqual(res.currency, 'UZS');
  });

  test('3. "1.234,56 so\'m" -> 1234.56 UZS', () => {
    const res = parseLocalUzbekIntent("to'lov 1.234,56 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.amount, 1234.56);
    assert.strictEqual(res.currency, 'UZS');
  });

  test('3. "1400$" va "$1400" -> 1400 USD', () => {
    const r1 = parseLocalUzbekIntent("telefon 1400$", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r1.amount, 1400);
    assert.strictEqual(r1.currency, 'USD');

    const r2 = parseLocalUzbekIntent("telefon $1400", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r2.amount, 1400);
    assert.strictEqual(r2.currency, 'USD');
  });

  test('3. "1.5 ming so\'m" va "1,5 ming so‘m" -> 1500 UZS', () => {
    const r1 = parseLocalUzbekIntent("taksi 1.5 ming so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r1.amount, 1500);
    assert.strictEqual(r1.currency, 'UZS');

    const r2 = parseLocalUzbekIntent("taksi 1,5 ming so‘m", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r2.amount, 1500);
    assert.strictEqual(r2.currency, 'UZS');
  });

  test('3. "tushlik 45000 so\'m taksi 20000 so\'m" -> bir nechta pul miqdori bloklanadi', () => {
    const res = parseLocalUzbekIntent("tushlik 45000 so'm taksi 20000 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(res.isMultipleActionsBlocked, true);
    assert.strictEqual(res.category, 'noaniq');
  });

  // 4. Oddiy "va" bog'lovchisi avtomatik xato deb hisoblanmasligi
  test('4. Oddiy "va" bog\'lovchisi xato bo\'lmasligi (dushanba va juma, tushlik va choy)', () => {
    const r1 = parseLocalUzbekIntent("har dushanba va juma 20 bet kitob", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r1.category, 'odat');
    assert.strictEqual(r1.isMultipleActionsBlocked, undefined);
    assert.deepStrictEqual(r1.daysOfWeek, [1, 5]);

    const r2 = parseLocalUzbekIntent("tushlik va choy 45000 so'm", { referenceDate: refDate, timezone: refTz });
    assert.strictEqual(r2.category, 'harajat');
    assert.strictEqual(r2.amount, 45000);
    assert.strictEqual(r2.isMultipleActionsBlocked, undefined);
  });

  // 5. Nisbiy vaqtning timezone xatosi (20 daqiqadan keyin yarim tundan o'tganda)
  test('5. 23:50 da "20 daqiqadan keyin" Asia/Tashkent bo\'yicha 00:10 va ertangi sana bo\'lishi', () => {
    // 2026-03-04 23:50 in Tashkent (UTC: 2026-03-04 18:50 UTC)
    const lateNightDate = new Date('2026-03-04T18:50:00.000Z');
    const res = parseLocalUzbekIntent("20 daqiqadan keyin hisobot yuborish", {
      referenceDate: lateNightDate,
      timezone: 'Asia/Tashkent',
    });

    assert.strictEqual(res.time, '00:10');
    assert.strictEqual(res.date, '2026-03-05');
  });

  // 6. Deterministik preflight: AI javobida blok bayrog'i bo'lmasa yoki AI "kunora"ni daily deb qaytarsa ham bloklanishi
  await test('6. AI "kunora"ni daily deb qaytarganda ham preflight orqali bloklanishi', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          parsed: {
            category: 'odat',
            title: 'Kitob o\'qish',
            frequency: 'daily',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            quantity: 20,
            unit: 'sahifa',
            isInterval: false, // AI yolg'on / noto'g'ri bayroq qaytarmoqda
          },
        }),
      };
    };

    try {
      const res = await parseUzbekIntent("kunora 20 bet kitob", {
        referenceDate: refDate,
        timezone: refTz,
        aiEnabled: true,
      });

      assert.strictEqual(res.isIntervalBlocked, true);
      assert.strictEqual(res.category, 'noaniq');
      assert.notStrictEqual(res.frequency, 'daily');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test('6. AI "daromad"ni harajat deb qaytarganda ham preflight orqali bloklanishi', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          parsed: {
            category: 'harajat',
            title: 'Ish haqi',
            amount: 500000,
            currency: 'UZS',
            isIncome: false,
          },
        }),
      };
    };

    try {
      const res = await parseUzbekIntent("daromad: 500000 ish haqi", {
        referenceDate: refDate,
        timezone: refTz,
        aiEnabled: true,
      });

      assert.strictEqual(res.isIncomeBlocked, true);
      assert.strictEqual(res.category, 'noaniq');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 7. Runtime validator: noto'g'ri qiymatlarni jim almashtirmasligi
  test('7. Validator noto\'g\'ri sana (2026-02-31) ni bugunga almashtirmasdan xato berishi', () => {
    const valRes = validateParsedItemContract({
      category: 'vazifa',
      title: 'Hisobot',
      date: '2026-02-31',
      time: '14:00',
    });

    assert.strictEqual(valRes.isValid, false);
    assert.ok(valRes.errors.some(e => e.includes('2026-02-31')));
  });

  test('7. Validator noto\'g\'ri vaqt (25:90) ni shunchaki null qilib o\'tkazmasdan xato berishi', () => {
    const valRes = validateParsedItemContract({
      category: 'vazifa',
      title: 'Majlis',
      date: '2026-03-04',
      time: '25:90',
    });

    assert.strictEqual(valRes.isValid, false);
    assert.ok(valRes.errors.some(e => e.includes('25:90')));
  });

  test('7. specific_days uchun kamida bitta 1..7 kun talab qilinishi (noto\'g\'ri kunlar barchaga aylanmaydi)', () => {
    const valRes = validateParsedItemContract({
      category: 'odat',
      title: 'Sport',
      frequency: 'specific_days',
      daysOfWeek: [8, 9, NaN],
    });

    assert.strictEqual(valRes.isValid, false);
    assert.ok(valRes.errors.some(e => e.includes('specific_days')));
  });

  test('7. weekly_target uchun 1..7 butun son talab qilinishi (taxminiy 3 yasalmaydi)', () => {
    const valRes = validateParsedItemContract({
      category: 'odat',
      title: 'Yugurish',
      frequency: 'weekly_target',
      targetDaysPerWeek: null,
    });

    assert.strictEqual(valRes.isValid, false);
    assert.ok(valRes.errors.some(e => e.includes('weekly_target')));
  });

  test('7. Noma\'lum valyuta ("EUR") jim UZS ga aylantirilmasligi va xato berishi', () => {
    const valRes = validateParsedItemContract({
      category: 'harajat',
      title: 'Xizmat',
      amount: 100,
      currency: 'EUR',
    });

    assert.strictEqual(valRes.isValid, false);
    assert.ok(valRes.errors.some(e => e.includes('EUR')));
  });

  // 8. Buzilgan AI natijasida lokal fallback to'liq ishlashi
  await test('8. Buzilgan AI javobida asl matn va ayni kontekst bilan lokal fallback ishlashi', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          parsed: {
            category: 'corrupted_category',
            title: '',
            amount: 'bir_million',
            date: '2026-02-31',
          },
        }),
      };
    };

    try {
      const res = await parseUzbekIntent("ertaga soat 15:00 da hisobot topshirish", {
        referenceDate: refDate,
        timezone: refTz,
        aiEnabled: true,
      });

      assert.strictEqual(res.category, 'vazifa');
      assert.strictEqual(res.time, '15:00');
      assert.strictEqual(res.date, '2026-03-05');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 9. Yaratish chegarasini himoyalash: buildExpenseCreatePayload va buildHabitCreatePayload
  test('9. buildExpenseCreatePayload nol yoki manfiy summada xatolik qaytarishi', () => {
    const invalidParsed: ParsedItem = {
      category: 'harajat',
      title: 'Tushlik',
      amount: 0,
      currency: 'UZS',
      confidence: 0.9,
      explanationUz: '',
      source: 'local-rules',
    };

    const res = buildExpenseCreatePayload(invalidParsed, '2026-03-04', '12:00');
    assert.strictEqual(res.success, false);
  });

  test('9. buildHabitCreatePayload yaroqsiz recurrence da xatolik qaytarishi', () => {
    const invalidWeekly: ParsedItem = {
      category: 'odat',
      title: 'Zal',
      frequency: 'weekly_target',
      targetDaysPerWeek: null,
      confidence: 0.9,
      explanationUz: '',
      source: 'local-rules',
    };

    const resWeekly = buildHabitCreatePayload(invalidWeekly);
    assert.strictEqual(resWeekly.success, false);

    const invalidDays: ParsedItem = {
      category: 'odat',
      title: 'Kitob',
      frequency: 'specific_days',
      daysOfWeek: [],
      confidence: 0.9,
      explanationUz: '',
      source: 'local-rules',
    };

    const resDays = buildHabitCreatePayload(invalidDays);
    assert.strictEqual(resDays.success, false);
  });

  test('9. buildHabitCreatePayload to\'g\'ri odat uchun frequency va daysOfWeek ni bus-butun saqlashi', () => {
    const validWeekly: ParsedItem = {
      category: 'odat',
      title: 'Suzish',
      frequency: 'weekly_target',
      targetDaysPerWeek: 3,
      confidence: 0.9,
      explanationUz: '',
      source: 'local-rules',
    };

    const res = buildHabitCreatePayload(validWeekly);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.payload.frequency, 'weekly_target');
      assert.strictEqual(res.payload.targetDaysPerWeek, 3);
    }
  });

  // 10. Production clarify_type va umumiy yaratish dispatcher'i (processEntityCreationFromParsed) testlari
  test('10. clarify_type oqimi: weekly_target turi tanlangandan keyin ham saqlanadi', () => {
    // Parserdan noaniq deb chiqqan, ammo haftalik jadvalga ega ParsedItem
    const ambiguousWeekly: ParsedItem = {
      category: 'noaniq',
      title: 'Haftasiga 3 kun zal',
      frequency: 'weekly_target',
      targetDaysPerWeek: 3,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      confidence: 0.85,
      explanationUz: '',
      source: 'local-rules',
    };

    // AppContext dagi clarify_type tugmasi payload'i: { ...parsed, category: 'odat' }
    const clarifyPayload: ParsedItem = { ...ambiguousWeekly, category: 'odat' };
    const res = processEntityCreationFromParsed(clarifyPayload, '2026-03-04', '12:00');

    assert.strictEqual(res.success, true);
    if (res.success && res.entityType === 'odat') {
      assert.strictEqual(res.payload.frequency, 'weekly_target');
      assert.strictEqual(res.payload.targetDaysPerWeek, 3);
      assert.strictEqual(res.payload.title, 'Haftasiga 3 kun zal');
    }
  });

  test('10. clarify_type oqimi: specific_days turi tanlangandan keyin ham saqlanadi', () => {
    const ambiguousSpecific: ParsedItem = {
      category: 'noaniq',
      title: 'Dushanba va juma kitob o\'qish',
      frequency: 'specific_days',
      daysOfWeek: [1, 5],
      quantity: 20,
      unit: 'sahifa',
      confidence: 0.85,
      explanationUz: '',
      source: 'local-rules',
    };

    const clarifyPayload: ParsedItem = { ...ambiguousSpecific, category: 'odat' };
    const res = processEntityCreationFromParsed(clarifyPayload, '2026-03-04', '12:00');

    assert.strictEqual(res.success, true);
    if (res.success && res.entityType === 'odat') {
      assert.strictEqual(res.payload.frequency, 'specific_days');
      assert.deepStrictEqual(res.payload.daysOfWeek, [1, 5]);
      assert.strictEqual(res.payload.targetQuantity, 20);
      assert.strictEqual(res.payload.unit, 'sahifa');
    }
  });

  test('10. clarify_type oqimi: parserdan chiqqan haqiqiy tokenlar bilan toifa tanlash (End-to-End)', () => {
    const parsed = parseLocalUzbekIntent("haftasiga 4 kun suzish");
    assert.strictEqual(parsed.frequency, 'weekly_target');
    assert.strictEqual(parsed.targetDaysPerWeek, 4);

    // Foydalanuvchi Odat tugmasini tanlaydi
    const userSelectedHabit: ParsedItem = { ...parsed, category: 'odat' };
    const res = processEntityCreationFromParsed(userSelectedHabit, '2026-03-04', '12:00');

    assert.strictEqual(res.success, true);
    if (res.success && res.entityType === 'odat') {
      assert.strictEqual(res.payload.frequency, 'weekly_target');
      assert.strictEqual(res.payload.targetDaysPerWeek, 4);
      assert.strictEqual(res.payload.title, 'Suzish');
    }
  });

  test('10. processEntityCreationFromParsed: manfiy va Infinity summa rad etiladi', () => {
    const negativeParsed: ParsedItem = {
      category: 'harajat',
      title: 'Taksi',
      amount: -15000,
      currency: 'UZS',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const resNegative = processEntityCreationFromParsed(negativeParsed, '2026-03-04', '12:00');
    assert.strictEqual(resNegative.success, false);

    const infinityParsed: ParsedItem = {
      category: 'harajat',
      title: 'Taksi',
      amount: Infinity,
      currency: 'UZS',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const resInfinity = processEntityCreationFromParsed(infinityParsed, '2026-03-04', '12:00');
    assert.strictEqual(resInfinity.success, false);
  });

  test('10. processEntityCreationFromParsed: xarajatda summa bo\'lmaganda aniqlashtirish talab qilinadi', () => {
    const noAmountParsed: ParsedItem = {
      category: 'harajat',
      title: 'Tushlik',
      amount: null,
      currency: 'UZS',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const res = processEntityCreationFromParsed(noAmountParsed, '2026-03-04', '12:00');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.promptClarification, true);
    }
  });

  test('10. processEntityCreationFromParsed: noto\'g\'ri sana (2026-02-31) vazifada rad etiladi', () => {
    const invalidDateTask: ParsedItem = {
      category: 'vazifa',
      title: 'Hisobot topshirish',
      date: '2026-02-31',
      time: '14:00',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const res = processEntityCreationFromParsed(invalidDateTask, '2026-03-04', '12:00');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.ok(res.error.includes('2026-02-31'));
    }
  });

  test('10. processEntityCreationFromParsed: noto\'g\'ri sana (2026-02-31) xarajatda rad etiladi', () => {
    const invalidDateExp: ParsedItem = {
      category: 'harajat',
      title: 'Bozorlik',
      amount: 150000,
      currency: 'UZS',
      date: '2026-02-31',
      time: '14:00',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const res = processEntityCreationFromParsed(invalidDateExp, '2026-03-04', '12:00');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.ok(res.error.includes('2026-02-31'));
    }
  });

  test('10. processEntityCreationFromParsed: clarificationNeeded mavjud bo\'lganda entity yaratilmaydi', () => {
    const clarificationItem: ParsedItem = {
      category: 'vazifa',
      title: 'Uchrashuv',
      clarificationNeeded: 'Aniq vaqt yoki joyni kiriting',
      confidence: 0.8,
      explanationUz: '',
      source: 'local-rules',
    };
    const res = processEntityCreationFromParsed(clarificationItem, '2026-03-04', '12:00');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.promptClarification, true);
      assert.strictEqual(res.error, 'Aniq vaqt yoki joyni kiriting');
    }
  });

  test('10. "boshqa" xarajat kategoriyasi validateParsedItemContract va payload builder dan muvaffaqiyatli o\'tadi', () => {
    const rawExpense = {
      category: 'harajat',
      title: 'Xayriya',
      amount: 75000,
      currency: 'UZS',
      expenseCategory: 'boshqa',
    };

    const valResult = validateParsedItemContract(rawExpense);
    assert.strictEqual(valResult.isValid, true);
    assert.strictEqual(valResult.item?.expenseCategory, 'boshqa');

    const res = processEntityCreationFromParsed(valResult.item!, '2026-03-04', '12:00');
    assert.strictEqual(res.success, true);
    if (res.success && res.entityType === 'harajat') {
      assert.strictEqual(res.payload.category, 'boshqa');
      assert.strictEqual(res.payload.amount, 75000);
      assert.strictEqual(res.payload.currency, 'UZS');
    }
  });

  test('10. Salomatlik qabulida foydalanuvchi aytmagan doza yoki qabul vaqti qo\'shilmaydi (uydirma yo\'q)', () => {
    // Foydalanuvchi faqat nomini kiritgan, doza (masalan "5 gram") yoki vaqt aytmagan
    const rawSupplement: ParsedItem = {
      category: 'qabul',
      title: 'Kreatin',
      dosage: null,
      timeSlot: null,
      confidence: 0.9,
      explanationUz: '',
      source: 'local-rules',
    };

    const res = processEntityCreationFromParsed(rawSupplement, '2026-03-04', '12:00');
    assert.strictEqual(res.success, true);
    if (res.success && res.entityType === 'qabul') {
      assert.strictEqual(res.payload.dosage, undefined);
      assert.strictEqual(res.payload.timeSlot, undefined);
      assert.strictEqual(res.payload.habitType, 'supplement_health');
    }
  });

  console.log(`\nJami: ${passed} muvaffaqiyatli, ${failed} xato.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
