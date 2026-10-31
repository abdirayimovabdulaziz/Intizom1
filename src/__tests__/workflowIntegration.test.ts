import {
  domainReducer,
  DomainState,
} from '../context/domainReducer';
import {
  applyHabitQuantityChange,
  calculateCalendarPeriodSummary,
  getDateStringInTimezone,
  addDaysToYMD,
  parseAndValidateBackup,
  BackupValidationContext,
} from '../utils/domainCalculations';
import {
  parseUzbekIntent,
  buildActivityCreatePayload,
} from '../utils/uzbekNlp';
import { Habit, Activity, UserSettings } from '../types';

interface StepResult {
  step: number;
  description: string;
  expected: string;
  actual: string;
  success: boolean;
}

const results: StepResult[] = [];

function recordResult(step: number, description: string, expected: string, actual: string, success: boolean) {
  results.push({ step, description, expected, actual, success });
  const icon = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Qadam ${step}]: ${description}`);
  console.log(`   Kutilgan: ${expected}`);
  console.log(`   Haqiqiy:  ${actual}`);
}

async function runWorkflow() {
  console.log('\n============================================================');
  console.log('KUNLIK YORDAMCHI: AMALIY INTEGRATSION ISH OQIMI TEKSHIRUVI');
  console.log('============================================================\n');

  const todayStr = '2026-10-31';
  const yesterdayStr = addDaysToYMD(todayStr, -1); // '2026-10-30'
  const timezone = 'Asia/Tashkent';

  // --------------------------------------------------------------------------
  // QADAM 1: Miqdorli kitob odatiga qo'lda 10 bet kiritish
  // --------------------------------------------------------------------------
  const initialHabit: Habit = {
    id: 'habit-book-workflow',
    title: 'Kitob o\'qish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 30,
    unit: 'bet',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  let domainState: DomainState = {
    activities: [],
    habits: [initialHabit],
    goals: [],
  };

  // Foydalanuvchi qo'lda 10 bet kiritadi
  const { updatedHabit } = applyHabitQuantityChange(
    domainState.habits[0],
    undefined,
    10,
    todayStr,
    '2026-10-31T09:00:00Z'
  );

  domainState = {
    ...domainState,
    habits: [updatedHabit],
  };

  const step1ActualQty = domainState.habits[0].history[todayStr]?.quantity;
  const step1ManualQty = domainState.habits[0].history[todayStr]?.manualQuantity;
  const step1Success = step1ActualQty === 10 && step1ManualQty === 10;

  recordResult(
    1,
    'Miqdorli kitob odatiga qo\'lda 10 bet kiritish',
    'manualQuantity = 10, jami quantity = 10',
    `manualQuantity = ${step1ManualQty}, jami quantity = ${step1ActualQty}`,
    step1Success
  );

  // --------------------------------------------------------------------------
  // QADAM 2: Kalendarda shu odatga bog'langan 20 bet faoliyat yaratish
  // --------------------------------------------------------------------------
  const activity20: Activity = {
    id: 'act-book-20',
    title: 'Kitob mutolaasi',
    localDate: todayStr,
    category: 'talim',
    quantity: 20,
    unit: 'bet',
    linkedHabitId: 'habit-book-workflow',
    source: 'manual',
    createdAt: '2026-10-31T11:00:00Z',
  };

  domainState = domainReducer(domainState, {
    type: 'ADD_ACTIVITY',
    activity: activity20,
    dateStr: todayStr,
  });

  const step2Habit = domainState.habits.find(h => h.id === 'habit-book-workflow')!;
  const step2DayRec = step2Habit.history[todayStr];
  const step2Total = step2DayRec?.quantity;
  const step2Manual = step2DayRec?.manualQuantity;
  const step2Contrib = step2DayRec?.activityContributions?.['act-book-20']?.quantity;
  const step2ActivitiesCount = domainState.activities.length;
  const step2Success = step2Total === 30 && step2Manual === 10 && step2Contrib === 20 && step2ActivitiesCount === 1;

  recordResult(
    2,
    'Kalendarda shu odatga bog\'langan 20 bet faoliyat yaratish (jami 30 bo\'lishi)',
    'jami = 30 (qo\'lda 10 + faoliyat 20), faoliyatlar soni = 1',
    `jami = ${step2Total} (qo'lda ${step2Manual} + faoliyat ${step2Contrib}), faoliyatlar soni = ${step2ActivitiesCount}`,
    step2Success
  );

  // --------------------------------------------------------------------------
  // QADAM 3: Faoliyatni 25 betga tahrirlash (jami 35 bo'lishi)
  // --------------------------------------------------------------------------
  domainState = domainReducer(domainState, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-book-20',
    updates: { quantity: 25 },
    dateStr: todayStr,
  });

  const step3Habit = domainState.habits.find(h => h.id === 'habit-book-workflow')!;
  const step3DayRec = step3Habit.history[todayStr];
  const step3Total = step3DayRec?.quantity;
  const step3Manual = step3DayRec?.manualQuantity;
  const step3Contrib = step3DayRec?.activityContributions?.['act-book-20']?.quantity;
  const step3Success = step3Total === 35 && step3Manual === 10 && step3Contrib === 25;

  recordResult(
    3,
    'Faoliyatni 25 betga tahrirlash (jami 35 bo\'lishi)',
    'jami = 35 (qo\'lda 10 + faoliyat 25)',
    `jami = ${step3Total} (qo'lda ${step3Manual} + faoliyat ${step3Contrib})`,
    step3Success
  );

  // --------------------------------------------------------------------------
  // QADAM 4: Faoliyatni o'chirish: qo'lda kiritilgan 10 bet qolishi
  // --------------------------------------------------------------------------
  domainState = domainReducer(domainState, {
    type: 'DELETE_ACTIVITY',
    id: 'act-book-20',
    dateStr: todayStr,
  });

  const step4Habit = domainState.habits.find(h => h.id === 'habit-book-workflow')!;
  const step4DayRec = step4Habit.history[todayStr];
  const step4Total = step4DayRec?.quantity;
  const step4Manual = step4DayRec?.manualQuantity;
  const step4ContribsRemaining = step4DayRec?.activityContributions;
  const step4ActivitiesCount = domainState.activities.length;
  const step4Success =
    step4Total === 10 &&
    step4Manual === 10 &&
    step4ContribsRemaining === undefined &&
    step4ActivitiesCount === 0;

  recordResult(
    4,
    'Faoliyatni o\'chirish: qo\'lda kiritilgan 10 bet qolishi',
    'jami = 10, manualQuantity = 10, activityContributions = undefined, faoliyatlar soni = 0',
    `jami = ${step4Total}, manualQuantity = ${step4Manual}, activityContributions = ${step4ContribsRemaining ? 'mavjud' : 'undefined'}, faoliyatlar soni = ${step4ActivitiesCount}`,
    step4Success
  );

  // --------------------------------------------------------------------------
  // QADAM 5: Saqlangan holatni qayta yuklash va export/import qilish
  // --------------------------------------------------------------------------
  const dummySettings: UserSettings = {
    name: 'Sinov Foydalanuvchisi',
    username: 'sinovchi',
    timezone: 'Asia/Tashkent',
    morningTime: '08:00',
    eveningTime: '21:00',
    reminderSound: true,
    aiEnabled: true,
  };

  const backupPayload = {
    appName: 'Kunlik Yordamchi',
    exportDate: '2026-10-31T12:00:00Z',
    tasks: [],
    habits: domainState.habits,
    goals: [],
    expenses: [],
    activities: domainState.activities,
    settings: dummySettings,
  };

  const jsonExported = JSON.stringify(backupPayload, null, 2);

  const validationContext: BackupValidationContext = {
    todayStr,
    currentTasks: [],
    currentHabits: domainState.habits,
    currentGoals: [],
    currentExpenses: [],
    currentActivities: domainState.activities,
    currentSettings: dummySettings,
  };

  const importResult = parseAndValidateBackup(jsonExported, validationContext);
  let step5Success = false;
  let step5Detail = '';

  if (importResult.isValid) {
    const importedHabit = importResult.candidateData.habits.find(h => h.id === 'habit-book-workflow');
    const importedDayRec = importedHabit?.history[todayStr];
    const qtyMatch = importedDayRec?.quantity === 10;
    const manualMatch = importedDayRec?.manualQuantity === 10;
    const noActs = importResult.candidateData.activities.length === 0;
    step5Success = qtyMatch && manualMatch && noActs;
    step5Detail = `isValid = true, qayta yuklangan habit miqdori = ${importedDayRec?.quantity}, faoliyatlar soni = ${importResult.candidateData.activities.length}`;
  } else {
    step5Detail = `isValid = false, xatolik: ${importResult.error}`;
  }

  recordResult(
    5,
    'Saqlangan holatni export/import qilish va natijani tekshirish',
    'isValid = true, qayta yuklangan habit miqdori = 10, faoliyatlar soni = 0',
    step5Detail,
    step5Success
  );

  // --------------------------------------------------------------------------
  // QADAM 6: Chatga "Kecha basseynda 40 daqiqa suzdim" yozish va tasdiqlash
  // --------------------------------------------------------------------------
  const chatInput = 'Kecha basseynda 40 daqiqa suzdim';
  const refDate = new Date(`${todayStr}T15:00:00+05:00`);
  const nlpParsed = await parseUzbekIntent(chatInput, {
    referenceDate: refDate,
    timezone,
    aiEnabled: false,
  });

  const parsedOk =
    nlpParsed.category === 'faoliyat' &&
    nlpParsed.date === yesterdayStr &&
    nlpParsed.durationMinutes === 40;

  // Tasdiqlangandan so'ng faoliyat yaratish
  const createPayloadRes = buildActivityCreatePayload(nlpParsed, todayStr, '15:00');
  let step6Success = false;
  let step6Detail = '';

  if (createPayloadRes.success) {
    const newActivity: Activity = {
      ...createPayloadRes.payload,
      id: 'act-swimming-yesterday',
      createdAt: '2026-10-31T15:00:00Z',
    };

    domainState = domainReducer(domainState, {
      type: 'ADD_ACTIVITY',
      activity: newActivity,
      dateStr: todayStr,
    });

    // Kechagi kalendar sarhisobini hisoblaymiz (aynan kechagi hafta yoki kun)
    const calSummary = calculateCalendarPeriodSummary(
      domainState.activities,
      domainState.habits,
      [],
      'hafta',
      todayStr,
      timezone
    );

    const yesterdayActivities = domainState.activities.filter(a => a.localDate === yesterdayStr);
    const countOk = yesterdayActivities.length === 1;
    const item = yesterdayActivities[0];
    const durationOk = item?.durationMinutes === 40;
    const catOk = item?.category === 'sport';
    const calSportOk = calSummary.categoryBreakdown.sport.count === 1 && calSummary.categoryBreakdown.sport.totalDurationMinutes === 40;

    step6Success = parsedOk && countOk && durationOk && catOk && calSportOk;
    step6Detail = `NLP: category="${nlpParsed.category}", date=${nlpParsed.date}, duration=${nlpParsed.durationMinutes}m; Kalendarda kecha: ${yesterdayActivities.length} ta yozuv ("${item?.title}", ${item?.durationMinutes} daqiqa sport)`;
  } else {
    step6Detail = `Payload builder xatosi: ${createPayloadRes.error}`;
  }

  recordResult(
    6,
    'Chatga "Kecha basseynda 40 daqiqa suzdim" yozish va kechagi kalendarda ko\'rinishi',
    `sana = ${yesterdayStr}, davomiylik = 40 daqiqa, toifa = sport, kalendarda 1 marta`,
    step6Detail,
    step6Success
  );

  console.log('\n============================================================');
  const allPassed = results.every(r => r.success);
  console.log(`XULOSA: ${results.filter(r => r.success).length}/${results.length} qadam muvaffaqiyatli.`);
  console.log('============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runWorkflow();
