import {
  applyHabitQuantityChange,
  applyHabitToggle,
  applyHabitCompletionStatus,
  calculateHabitStreakAndStats,
  calculateInternalHabitStreak,
  calculateInternalHabitStats,
  calculatePostponedTask,
  calculateHabitIntakeDecision,
  generateEntityId,
  areUnitsCompatible,
  getDateStringInTimezone,
  addDaysToYMD,
  validateDaysOfWeek,
  isValidYMD,
  validateActivity,
  getCalendarPeriodBounds,
  calculateCalendarPeriodSummary,
  getPreviousDayOfWeekYMD,
  getTaskCompletionDateInTimezone,
  validateTimeHHMM,
  parseAndValidateBackup,
  BackupValidationContext,
} from '../utils/domainCalculations';
import { Habit, Goal, Task, GoalInternalHabit, Activity, Expense, UserSettings } from '../types';
import {
  domainReducer,
  DomainState,
  normalizeHabitForDate,
  normalizeGoalInternalHabitsForDate,
} from '../context/domainReducer';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

console.log('=== KUNLIK YORDAMCHI DOMEN TESTLARI ===\n');

// Test A: Miqdor 2, delta -10 (Odat 0 bo'ladi, bog'langan maqsad faqat -2 ga o'zgaradi)
{
  const habit: Habit = {
    id: 'habit-1',
    title: 'Kitob o\'qish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 10,
    unit: 'bet',
    streak: 1,
    bestStreak: 1,
    history: {
      '2026-10-29': { completed: false, quantity: 2 },
    },
  };

  const goal: Goal = {
    id: 'goal-1',
    title: '300 bet kitob',
    category: 'maqsad',
    deadline: '2026-11-30',
    targetValue: 300,
    currentValue: 50,
    unit: 'bet',
    linkedHabitIds: ['habit-1'],
    status: 'active',
  };

  const { updatedHabit, updatedGoal, actualDelta } = applyHabitQuantityChange(
    habit,
    goal,
    -10,
    '2026-10-29',
    '2026-10-29T10:00:00Z'
  );

  assert(actualDelta === -2, 'a) actualDelta -10 emas, -2 bo\'lishi kerak', `Haqiqiy delta: ${actualDelta}`);
  assert(updatedHabit.currentQuantityToday === 0, 'a) Odat miqdori manfiy bo\'lmasdan 0 ga teng bo\'lishi kerak');
  assert(updatedHabit.history['2026-10-29'].quantity === 0, 'a) Tarixda miqdor 0');
  assert(updatedGoal?.currentValue === 48, 'a) Maqsad 50 - 2 = 48 bo\'lishi kerak (40 emas!)', `Maqsad: ${updatedGoal?.currentValue}`);
}

// Test B: Bir kunda bir necha marta miqdor qo'shish
{
  let habit: Habit = {
    id: 'habit-water',
    title: 'Suv ichish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 8,
    unit: 'stakan',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  let goal: Goal = {
    id: 'goal-water',
    title: 'Oylik suv balansi',
    category: 'maqsad',
    deadline: '2026-11-30',
    targetValue: 240,
    currentValue: 100,
    unit: 'stakan',
    linkedHabitIds: ['habit-water'],
    status: 'active',
  };

  // 1-qabul: +2 stakan
  const res1 = applyHabitQuantityChange(habit, goal, 2, '2026-10-29', '2026-10-29T08:00:00Z');
  habit = res1.updatedHabit;
  goal = res1.updatedGoal!;

  // 2-qabul: +3 stakan
  const res2 = applyHabitQuantityChange(habit, goal, 3, '2026-10-29', '2026-10-29T12:00:00Z');
  habit = res2.updatedHabit;
  goal = res2.updatedGoal!;

  // 3-qabul: +4 stakan (jami 9 stakan >= target 8)
  const res3 = applyHabitQuantityChange(habit, goal, 4, '2026-10-29', '2026-10-29T18:00:00Z');
  habit = res3.updatedHabit;
  goal = res3.updatedGoal!;

  assert(habit.currentQuantityToday === 9, 'b) Bir kunda jami miqdor 9 bo\'lishi kerak');
  assert(habit.history['2026-10-29'].completed === true, 'b) Maqsadli miqdor (8) ga yetganda completed=true bo\'lishi kerak');
  assert(habit.streak === 1, 'b) Bugun yakunlanganda streak 1 bo\'lishi kerak');
  assert(goal.currentValue === 109, 'b) Maqsad 100 + 2 + 3 + 4 = 109 bo\'lishi kerak', `Haqiqiy: ${goal.currentValue}`);
}

// Test C: Completion'ni bekor qilish (Kamaytirilganda streak va status qayta hisoblanishi)
{
  const habit: Habit = {
    id: 'habit-c',
    title: 'Mashq qilish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 30,
    unit: 'daqiqa',
    streak: 3,
    bestStreak: 3,
    history: {
      '2026-10-27': { completed: true, quantity: 30 },
      '2026-10-28': { completed: true, quantity: 30 },
      '2026-10-29': { completed: true, quantity: 30 },
    },
  };

  // Bugungi miqdordan -15 kamaytiramiz (30 -> 15 < target 30)
  const { updatedHabit } = applyHabitQuantityChange(
    habit,
    undefined,
    -15,
    '2026-10-29',
    '2026-10-29T20:00:00Z'
  );

  assert(updatedHabit.history['2026-10-29'].completed === false, 'c) Miqdor 15 bo\'lganda completed=false ga qaytishi kerak');
  // Kechagi kun completed bo'lgani sababli, streak hali buzilmagan (kechagigacha 2 kun davom etgan)
  assert(updatedHabit.streak === 2, 'c) Bugungi bekor bo\'lganda streak kechagiga qarab 2 bo\'lishi kerak', `Streak: ${updatedHabit.streak}`);
  assert(updatedHabit.bestStreak === 3, 'c) Best streak (3) saqlanib qolishi kerak');
}

// Test D: Orada rejalashtirilgan kunni o'tkazib yuborish (streak nolga tushishi)
{
  const history = {
    '2026-10-25': { completed: true },
    '2026-10-26': { completed: true },
    // 2026-10-27 o'tkazib yuborilgan (completed=false yoki yo'q)
    // 2026-10-28 o'tkazib yuborilgan
  };

  const stats = calculateHabitStreakAndStats(
    history,
    'daily',
    [1, 2, 3, 4, 5, 6, 7],
    3,
    '2026-10-29', // Bugun
    2
  );

  assert(stats.streak === 0, 'd) O\'tkazib yuborilgan kunlardan so\'ng streak 0 bo\'lishi kerak', `Streak: ${stats.streak}`);
  assert(stats.bestStreak === 2, 'd) Tarixdagi eng yaxshi streak (2) saqlanishi kerak');
}

// Test E: specific_days jadvalidagi dam olish kuni (streak'ni buzmasligi kerak)
{
  // Jadval: Dushanba (1), Chorshanba (3), Juma (5)
  // 2026-10-26 = Dushanba (Du) - completed
  // 2026-10-27 = Seshanba (Se) - dam olish kuni (jadvalda yo'q)
  // 2026-10-28 = Chorshanba (Chor) - completed
  // 2026-10-29 = Payshanba (Pay) - bugun (dam olish kuni!)
  const history = {
    '2026-10-26': { completed: true },
    '2026-10-28': { completed: true },
  };

  const stats = calculateHabitStreakAndStats(
    history,
    'specific_days',
    [1, 3, 5], // Dushanba, Chorshanba, Juma
    3,
    '2026-10-29', // Payshanba (dam olish kuni)
    0
  );

  assert(
    stats.streak === 2,
    'e) specific_days rejasidagi dam olish kuni (Payshanba) streak\'ni buzmasligi kerak (streak=2)',
    `Streak: ${stats.streak}`
  );
}

// Test F: Kamaytirish maqsadi (goalType='decrease')
{
  const habit: Habit = {
    id: 'habit-coffee',
    title: 'Kofe miqdorini kamaytirish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 1,
    unit: 'chashka',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  const goalDecrease: Goal = {
    id: 'goal-weight',
    title: 'Vaznni kamaytirish',
    category: 'maqsad',
    goalType: 'decrease',
    deadline: '2026-12-31',
    startValue: 90,
    targetValue: 80,
    currentValue: 85,
    unit: 'kg',
    linkedHabitIds: [],
    status: 'active',
  };

  // Agar birlik mos kelmasa (chashka vs kg), maqsad o'zgarmasligi kerak!
  const mismatchRes = applyHabitQuantityChange(habit, goalDecrease, 2, '2026-10-29', '2026-10-29T10:00:00Z');
  assert(
    mismatchRes.updatedGoal === undefined,
    'f) Birliklar mos kelmaganda (chashka vs kg) bog\'langan maqsad yangilanmasligi kerak'
  );

  // Endi mos keladigan birlik bilan kamaytirish maqsadi:
  const habitWeight: Habit = {
    ...habit,
    unit: 'kg',
  };

  // Vazn yo'qotish amali: +1 kg progress
  const matchRes = applyHabitQuantityChange(habitWeight, goalDecrease, 1, '2026-10-29', '2026-10-29T10:00:00Z');
  assert(
    matchRes.updatedGoal?.currentValue === 84,
    'f) goalType="decrease" da ijobiy progress joriy qiymatni kamaytirishi kerak (85 - 1 = 84)',
    `Haqiqiy: ${matchRes.updatedGoal?.currentValue}`
  );

  // Kamaytirib nishonga yetganda (currentValue <= targetValue 80) achieved bo'lishi kerak:
  const reachTargetRes = applyHabitQuantityChange(habitWeight, goalDecrease, 5, '2026-10-29', '2026-10-29T10:00:00Z');
  assert(
    reachTargetRes.updatedGoal?.currentValue === 80 && reachTargetRes.updatedGoal?.status === 'achieved',
    'f) Maqsad qiymatiga yetganda (80 kg) status="achieved" bo\'lishi kerak'
  );
}

// Test G: Yarim tundan o'tadigan kechiktirish (2026-10-29 23:50 + 15 min -> 2026-10-30 00:05)
{
  const task: Task = {
    id: 'task-night',
    title: 'Kechki hisobot',
    category: 'vazifa',
    date: '2026-10-29',
    time: '23:50',
    status: 'pending',
    priority: 'high',
    source: 'miniapp',
  };

  const postponed = calculatePostponedTask(task, 15, new Date('2026-10-29T18:50:00Z'), 'Asia/Tashkent');

  assert(postponed !== null, 'g) Kechiktirish muvaffaqiyatli natija qaytarishi kerak');
  assert(postponed?.date === '2026-10-30', 'g) Yarim tundan o\'tganda sana keyingi kunga o\'tishi kerak (2026-10-30)', `Sana: ${postponed?.date}`);
  assert(postponed?.time === '00:05', 'g) Yangi vaqt 00:05 bo\'lishi kerak', `Vaqt: ${postponed?.time}`);
  assert(postponed?.status === 'postponed', 'g) Status "postponed" bo\'lishi kerak');

  // Soati yo'q vazifani kechiktirish:
  const taskNoTime: Task = {
    ...task,
    time: undefined,
    date: '2026-10-29',
  };
  const fixedNow = new Date('2026-10-29T09:30:00Z'); // 14:30 in Tashkent (UTC+5)
  const postponedUntimed = calculatePostponedTask(taskNoTime, 30, fixedNow, 'Asia/Tashkent');
  assert(postponedUntimed !== null, 'g) Soatsiz vazifa kechiktirishi muvaffaqiyatli');
  assert(
    postponedUntimed?.date === '2026-10-29' && postponedUntimed?.time === '15:00',
    'g) Soati yo\'q bugungi vazifa joriy vaqtdan +30 daqiqaga surilishi kerak (14:30 + 30m -> 15:00)',
    `Natija: ${postponedUntimed?.date} ${postponedUntimed?.time}`
  );
}

// Test H: Yangi Entity ID (crypto.randomUUID) va eski ma'lumotlar mosligi
{
  const newTaskId = generateEntityId('task');
  const newHabitId = generateEntityId('habit');
  const newGoalId = generateEntityId('goal');

  assert(newTaskId.startsWith('task-'), 'h) Yangi task ID prefixi to\'g\'ri');
  assert(newHabitId.startsWith('habit-'), 'h) Yangi habit ID prefixi to\'g\'ri');
  assert(newGoalId.startsWith('goal-'), 'h) Yangi goal ID prefixi to\'g\'ri');
  assert(newTaskId !== newHabitId, 'h) ID lar noyob (unikal)');

  // Eski localStorage formatidagi ma'lumotlarni o'qish va mosligini tekshirish
  const legacyStorageData = {
    tasks: [
      { id: 'task-1730000000000', title: 'Eski vazifa', date: '2026-10-28', status: 'completed' },
    ],
    habits: [
      {
        id: 'habit-1730000000001',
        title: 'Eski odat',
        linkedGoalId: 'goal-1730000000002',
        streak: 5,
        bestStreak: 7,
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        history: { '2026-10-28': { completed: true, quantity: 1 } },
      },
    ],
    goals: [
      {
        id: 'goal-1730000000002',
        title: 'Eski maqsad',
        linkedHabitIds: ['habit-1730000000001'],
        currentValue: 5,
        targetValue: 10,
        unit: 'marta',
      },
    ],
  };

  const loadedHabit = legacyStorageData.habits[0] as unknown as Habit;
  const loadedGoal = legacyStorageData.goals[0] as unknown as Goal;

  assert(loadedHabit.linkedGoalId === loadedGoal.id, 'h) Eski linkedGoalId va linkedHabitIds bog\'liqligi saqlanadi');
  assert(loadedHabit.id === 'habit-1730000000001', 'h) Eski ID o\'zgarmaydi');
}

// Test I: Idempotentlik va React Strict Mode (bir xil amallar qayta bajarilganda sof natija)
{
  const habit: Habit = {
    id: 'habit-pure',
    title: 'Test',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  // Toggle habit on
  const resA = applyHabitToggle(habit, undefined, '2026-10-29', '2026-10-29T10:00:00Z');
  // React Strict Mode double-invocation simulation on same state
  const resB = applyHabitToggle(habit, undefined, '2026-10-29', '2026-10-29T10:00:00Z');

  assert(
    JSON.stringify(resA.updatedHabit) === JSON.stringify(resB.updatedHabit),
    'i) Sof funksiya/reducer bir xil kirish uchun bir xil natija beradi (React Strict Mode xavfsiz)'
  );
}

// Test J: Maqsad ichidagi ichki odatlar (tarixdan 'Jami X kun bajarilgan' ko'rsatkichi va streak'ni yo'qotmaslik)
{
  const internalHabit: GoalInternalHabit = {
    id: 'ghabit-1',
    title: 'Ertalabki yugurish',
    targetFrequency: 'Har kuni 20 daqiqa',
    completedToday: false,
    streak: 4,
    bestStreak: 7,
    history: {
      '2026-10-27': { completed: true },
      '2026-10-28': { completed: true },
    },
  };

  // 1. Tarixdagi bajarilgan kunlar soni alohida hisoblanadi va streak/bestStreak ni ezib tashlamaydi
  const statsPre = calculateInternalHabitStats(
    internalHabit.history,
    '2026-10-29',
    internalHabit.streak || 0,
    internalHabit.bestStreak || 0
  );
  assert(statsPre.totalCompletions === 2, 'j1) Ichki odat tarixdan jami 2 kun bajarilgan deb hisoblaydi', `Jami: ${statsPre.totalCompletions}`);
  assert(statsPre.streak === 4, 'j1) Ichki odatning mavjud streak (4) qiymati yo\'qolmasdan saqlanadi');
  assert(statsPre.bestStreak === 7, 'j1) Ichki odatning mavjud bestStreak (7) qiymati yo\'qolmasdan saqlanadi');

  // 2. Bugungi kun (2026-10-29) bajarilganda jami 3 kun bo'ladi
  const historyWithToday = {
    ...internalHabit.history,
    '2026-10-29': { completed: true, timestamp: '2026-10-29T08:00:00Z' },
  };
  const statsPost = calculateInternalHabitStats(
    historyWithToday,
    '2026-10-29',
    internalHabit.streak || 0,
    internalHabit.bestStreak || 0
  );
  assert(statsPost.totalCompletions === 3, 'j2) Ichki odat bugun bajarilganda jami 3 kun bo\'ladi', `Jami: ${statsPost.totalCompletions}`);

  // 3. Eski dateless legacy ichki odat migratsiyasi: bugunga uydirma completion YOZILMASIN
  const legacyInternalHabit: GoalInternalHabit = {
    id: 'ghabit-legacy',
    title: 'Eski ichki odat',
    targetFrequency: 'Kunlik',
    completedToday: true, // eski boolean
    streak: 5,
  };
  const legacyGoal: Goal = {
    id: 'goal-legacy',
    title: 'Eski maqsad',
    category: 'maqsad',
    deadline: '2026-12-31',
    currentValue: 0,
    targetValue: 100,
    unit: 'marta',
    status: 'active',
    linkedHabitIds: [],
    internalHabits: [legacyInternalHabit],
  };

  const normalizedGoal = normalizeGoalInternalHabitsForDate(legacyGoal, '2026-10-29');
  const normalizedHabit = normalizedGoal.internalHabits![0];
  assert(
    normalizedHabit.completedToday === false,
    'j3) Eski dateless odat uchun bugunga uydirma bajarilish belgilanmasin (completedToday=false)',
    `completedToday: ${normalizedHabit.completedToday}`
  );
  assert(
    normalizedHabit.streak === 5,
    'j3) Eski streak (5) o\'chib ketmasdan o\'z holida saqlanadi'
  );
  assert(
    normalizedHabit.totalCompletions === 0,
    'j3) Tarixsiz eski odatda totalCompletions 0 bo\'ladi',
    `totalCompletions: ${normalizedHabit.totalCompletions}`
  );
}

// Test K: calculatePostponedTask da 00:00 nol qiymat, kalendar sanasi tekshiruvi va xavfsiz kechiktirish
{
  // 1. Task vaqti aynan 00:00 bo'lgan holat (00 falsy deb 9:00 ga aylanib ketmasligi kerak!)
  const midnightTask: Task = {
    id: 'task-midnight',
    title: 'Tungi skript',
    category: 'vazifa',
    date: '2026-10-29',
    time: '00:00',
    status: 'pending',
    priority: 'low',
    source: 'miniapp',
  };
  const postponedMidnight = calculatePostponedTask(midnightTask, 15, new Date('2026-10-28T19:00:00Z'), 'Asia/Tashkent');
  assert(
    postponedMidnight !== null && postponedMidnight.date === '2026-10-29' && postponedMidnight.time === '00:15',
    'k1) 00:00 vaqtidagi vazifa +15 min surilganda 00:15 bo\'ladi (00 saqlanadi)',
    `Natija: ${postponedMidnight?.date} ${postponedMidnight?.time}`
  );

  // 2. Qurilma UTC da (19:00 UTC = 00:00 Tashkent) bo'lganda va vazifaning soati bo'lmaganda
  const untimedTask: Task = {
    ...midnightTask,
    time: undefined,
  };
  // 2026-10-28 19:10 UTC -> 2026-10-29 00:10 Tashkent
  const nowUtc = new Date('2026-10-28T19:10:00Z');
  const postponedInTashkent = calculatePostponedTask(untimedTask, 20, nowUtc, 'Asia/Tashkent');
  assert(
    postponedInTashkent !== null && postponedInTashkent.date === '2026-10-29' && postponedInTashkent.time === '00:30',
    'k2) Qurilma UTC da bo\'lsa ham Asia/Tashkent dagi 00:10 vaqtidan +20m = 00:30 bo\'ladi',
    `Natija: ${postponedInTashkent?.date} ${postponedInTashkent?.time}`
  );

  // 3. String sanani qat'iy kalendar sanasi sifatida tekshirish
  assert(calculatePostponedTask(midnightTask, 'abc', nowUtc) === null, 'k3) "abc" noto\'g\'ri format rad etiladi');
  assert(calculatePostponedTask(midnightTask, '2026-02-31', nowUtc) === null, 'k3) "2026-02-31" mavjud bo\'lmagan sana rad etiladi');
  assert(calculatePostponedTask(midnightTask, '2026-13-01', nowUtc) === null, 'k3) "2026-13-01" 13-oy rad etiladi');

  // Kabisa yili tekshiruvi:
  const leapValid = calculatePostponedTask(midnightTask, '2024-02-29', nowUtc);
  assert(leapValid !== null && leapValid.date === '2024-02-29', 'k3) 2024 kabisa yilida 29-fevral qabul qilinadi');
  const nonLeapInvalid = calculatePostponedTask(midnightTask, '2026-02-29', nowUtc);
  assert(nonLeapInvalid === null, 'k3) 2026 oddiy yilda 29-fevral rad etiladi');

  // Yil va oy almashishi:
  const endYearValid = calculatePostponedTask(midnightTask, '2026-12-31', nowUtc);
  assert(endYearValid !== null && endYearValid.date === '2026-12-31', 'k3) Yil oxiri 2026-12-31 qabul qilinadi');
  const newYearValid = calculatePostponedTask(midnightTask, '2027-01-01', nowUtc);
  assert(newYearValid !== null && newYearValid.date === '2027-01-01', 'k3) Yangi yil 2027-01-01 qabul qilinadi');

  // 4. NaN yoki Infinity kechiktirish qiymati rad etiladi (null qaytadi)
  assert(calculatePostponedTask(midnightTask, NaN, nowUtc, 'Asia/Tashkent') === null, 'k4) NaN kechiktirish null qaytaradi');
  assert(calculatePostponedTask(midnightTask, Infinity, nowUtc, 'Asia/Tashkent') === null, 'k4) Infinity kechiktirish null qaytaradi');

  // Rad etilgan amal vazifaning barcha maydonlarini o'zgartirmay saqlaydi
  const taskBefore: Task = { ...midnightTask };
  const updates = calculatePostponedTask(taskBefore, NaN, nowUtc, 'Asia/Tashkent');
  const taskAfter: Task = updates ? { ...taskBefore, ...updates } : taskBefore;
  assert(taskAfter.date === taskBefore.date, 'k5) Noto\'g\'ri raqamli kechiktirishda sana o\'zgarmaydi');
  assert(taskAfter.time === taskBefore.time, 'k5) Noto\'g\'ri raqamli kechiktirishda vaqt o\'zgarmaydi');
  assert(taskAfter.status === taskBefore.status, 'k5) Noto\'g\'ri raqamli kechiktirishda status o\'zgarmaydi');
  assert(taskAfter.postponedUntil === taskBefore.postponedUntil, 'k5) Noto\'g\'ri raqamli kechiktirishda postponedUntil o\'zgarmaydi');

  const updatesStr = calculatePostponedTask(taskBefore, '2026-02-31', nowUtc, 'Asia/Tashkent');
  const taskAfterStr: Task = updatesStr ? { ...taskBefore, ...updatesStr } : taskBefore;
  assert(taskAfterStr.date === taskBefore.date, 'k5) Noto\'g\'ri sanali kechiktirishda sana o\'zgarmaydi');
  assert(taskAfterStr.time === taskBefore.time, 'k5) Noto\'g\'ri sanali kechiktirishda vaqt o\'zgarmaydi');
  assert(taskAfterStr.status === taskBefore.status, 'k5) Noto\'g\'ri sanali kechiktirishda status o\'zgarmaydi');
  assert(taskAfterStr.postponedUntil === taskBefore.postponedUntil, 'k5) Noto\'g\'ri sanali kechiktirishda postponedUntil o\'zgarmaydi');
}

// Test L: bestStreak ni butun tarixdan izlash va kelajak sanalar himoyasi
{
  // 1. Muayyan kunlar (specific_days: Dushanba=1, Chorshanba=3, Juma=5)
  // Eski tarixdagi muvaffaqiyatli ketma-ketlik: 6 ta rejalashtirilgan kun ketma-ket bajarilgan,
  // lekin oxirgi paytlarda tashlab ketilgan (joriy streak = 0)
  const historyWithPastBest: Record<string, { completed: boolean }> = {
    '2026-09-07': { completed: true }, // Dush
    '2026-09-09': { completed: true }, // Chor
    '2026-09-11': { completed: true }, // Juma
    '2026-09-14': { completed: true }, // Dush
    '2026-09-16': { completed: true }, // Chor
    '2026-09-18': { completed: true }, // Juma  -> 6 ta sessiya ketma-ket
    // Keyin 1 oy o'tkazib yuborilgan
    '2026-10-28': { completed: false }, // Bugun streak 0
  };

  const specificStats = calculateHabitStreakAndStats(
    historyWithPastBest,
    'specific_days',
    [1, 3, 5],
    undefined,
    '2026-10-29',
    0
  );
  assert(specificStats.streak === 0, 'l1) Bugun streak 0 bo\'lishi kerak');
  assert(
    specificStats.bestStreak === 6,
    'l1) Tarixdagi 6 ta ketma-ketlik bugungi streak 0 bo\'lsa ham topilishi kerak',
    `bestStreak: ${specificStats.bestStreak}`
  );

  // 2. Haftalik target odat (weekly_target: haftada 2 kun)
  // Eski 3 hafta davomida target bajarilgan, joriy haftada esa hali bajarilmagan
  const weeklyHistory: Record<string, { completed: boolean }> = {
    // 1-hafta (2026-10-05 haftasi): 2 kun
    '2026-10-06': { completed: true },
    '2026-10-08': { completed: true },
    // 2-hafta (2026-10-12 haftasi): 2 kun
    '2026-10-13': { completed: true },
    '2026-10-15': { completed: true },
    // 3-hafta (2026-10-19 haftasi): 2 kun
    '2026-10-20': { completed: true },
    '2026-10-22': { completed: true },
    // Kelajakdagi sana (bugun 2026-10-29, 2026-10-31 esa kelajak):
    // Kelajak completion joriy haftaga hisoblanmasligi kerak
    '2026-10-31': { completed: true },
  };

  const weeklyStats = calculateHabitStreakAndStats(
    weeklyHistory,
    'weekly_target',
    undefined,
    2,
    '2026-10-29',
    0
  );
  assert(
    weeklyStats.bestStreak === 3,
    'l2) Haftalik odatda tarixiy 3 hafta ketma-ketlik topildi',
    `bestStreak: ${weeklyStats.bestStreak}`
  );
  assert(
    weeklyStats.weeklyCompletions === 0,
    'l2) Kelajakdagi sana (2026-10-31) bugungi kunda joriy haftaga hisoblanmasligi kerak',
    `weeklyCompletions: ${weeklyStats.weeklyCompletions}`
  );
}

// Test M: domainReducer mustaqil sof funksiyasini to'g'ridan-to'g'ri tekshirish
{
  const initialState: DomainState = {
    activities: [],
    habits: [
      {
        id: 'h-reducer-1',
        title: 'Kitob',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        targetQuantity: 10,
        unit: 'bet',
        streak: 0,
        bestStreak: 0,
        history: {},
        linkedGoalId: 'g-reducer-1',
      },
    ],
    goals: [
      {
        id: 'g-reducer-1',
        title: 'Kitob maqsadi',
        category: 'maqsad',
        deadline: '2026-12-31',
        startValue: 0,
        currentValue: 20,
        targetValue: 100,
        unit: 'bet',
        goalType: 'reach',
        status: 'active',
        linkedHabitIds: ['h-reducer-1'],
        internalHabits: [
          {
            id: 'ih-1',
            title: '1 bob o\'qish',
            targetFrequency: 'kunlik',
            completedToday: false,
            streak: 0,
            bestStreak: 0,
            history: {},
          },
        ],
      },
    ],
  };

  // 1. LOG_HABIT_QUANTITY
  const stateAfterLog = domainReducer(initialState, {
    type: 'LOG_HABIT_QUANTITY',
    habitId: 'h-reducer-1',
    amount: 5,
    dateStr: '2026-10-29',
    timestamp: '2026-10-29T10:00:00Z',
  });
  assert(
    stateAfterLog.habits[0].currentQuantityToday === 5,
    'm1) Reducer orqali miqdor qo\'shilganda habit 5 bo\'ladi'
  );
  assert(
    stateAfterLog.goals[0].currentValue === 25,
    'm1) Reducer orqali bog\'langan maqsad ham atomik 20 + 5 = 25 bo\'ladi'
  );

  // 2. TOGGLE_GOAL_INTERNAL_HABIT
  const stateAfterIhToggle = domainReducer(stateAfterLog, {
    type: 'TOGGLE_GOAL_INTERNAL_HABIT',
    goalId: 'g-reducer-1',
    habitId: 'ih-1',
    dateStr: '2026-10-29',
    timestamp: '2026-10-29T10:05:00Z',
  });
  const ih = stateAfterIhToggle.goals[0].internalHabits![0];
  assert(ih.completedToday === true, 'm2) Ichki odat TOGGLE_GOAL_INTERNAL_HABIT orqali belgilanadi');
  assert(ih.totalCompletions === 1, 'm2) Ichki odat totalCompletions 1 bo\'ladi');
  assert(ih.history!['2026-10-29'].completed === true, 'm2) Tarixda sana bilan saqlanadi');

  // 3. REFRESH_HABITS_DAILY_STATUS kun almashganda
  const stateNextDay = domainReducer(stateAfterIhToggle, {
    type: 'REFRESH_HABITS_DAILY_STATUS',
    dateStr: '2026-10-30',
  });
  assert(
    stateNextDay.habits[0].currentQuantityToday === 0,
    'm3) Yangi kunda odat miqdori 0 ga yangilanadi'
  );
  assert(
    stateNextDay.goals[0].internalHabits![0].completedToday === false,
    'm3) Yangi kunda ichki odat completedToday false bo\'ladi'
  );
  assert(
    stateNextDay.goals[0].internalHabits![0].totalCompletions === 1,
    'm3) Yangi kunda ham tarixdan olingan totalCompletions 1 saqlanadi'
  );
}

// Test N: normalizeHabitForDate va normalizeGoalInternalHabitsForDate
{
  const habitToNormalize: Habit = {
    id: 'h-norm',
    title: 'Sport',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 0,
    bestStreak: 0,
    history: {
      '2026-10-28': { completed: true, quantity: 1 },
    },
  };
  const normalized = normalizeHabitForDate(habitToNormalize, '2026-10-29');
  assert(normalized.streak === 1, 'n1) normalizeHabitForDate kechagi bajarilish asosida streak=1 hisoblaydi');
  assert(normalized.currentQuantityToday === 0, 'n1) Bugungi miqdor 0');
}

// Test O: validateDaysOfWeek qat'iy butun son tekshiruvi va cheksiz sikl xavfsizligi
{
  const def = [1, 2, 3, 4, 5, 6, 7];

  // 1. Kasr son [1.5]
  const resFloat = validateDaysOfWeek([1.5]);
  assert(
    JSON.stringify(resFloat) === JSON.stringify(def),
    'o1) [1.5] kasr son rad etilib standart 1..7 fallback qaytarishi kerak',
    `Natija: ${JSON.stringify(resFloat)}`
  );

  // 2. Diapazondan tashqari [0, 8]
  const resOutOfRange = validateDaysOfWeek([0, 8]);
  assert(
    JSON.stringify(resOutOfRange) === JSON.stringify(def),
    'o2) [0, 8] rad etilib standart fallback qaytarishi kerak',
    `Natija: ${JSON.stringify(resOutOfRange)}`
  );

  // 3. [NaN, Infinity]
  const resNanInf = validateDaysOfWeek([NaN, Infinity]);
  assert(
    JSON.stringify(resNanInf) === JSON.stringify(def),
    'o3) [NaN, Infinity] rad etilib standart fallback qaytarishi kerak',
    `Natija: ${JSON.stringify(resNanInf)}`
  );

  // 4. Aralash [1, 2.5, 3]
  const resMixed = validateDaysOfWeek([1, 2.5, 3]);
  assert(
    JSON.stringify(resMixed) === JSON.stringify([1, 3]),
    'o4) Aralash [1, 2.5, 3] dan faqat butun sonlar [1, 3] saralab olinishi kerak',
    `Natija: ${JSON.stringify(resMixed)}`
  );

  // 5. Yaroqsiz jadval berilganda calculateHabitStreakAndStats cheksiz siklga kirmasdan darhol tugashi kerak
  const startTime = Date.now();
  const badStats = calculateHabitStreakAndStats(
    { '2026-10-28': { completed: true } },
    'specific_days',
    [1.5, NaN, 9], // yaroqsiz jadval
    undefined,
    '2026-10-29',
    0
  );
  const elapsed = Date.now() - startTime;
  assert(elapsed < 500, 'o5) Yaroqsiz jadvalda streak hisobi cheksiz siklga kirmaydi (< 500ms)');
  assert(badStats.streak === 1, 'o5) Fallback (har kuni) asosida kechagi natijadan streak=1 hisoblanadi');
}

// Test P: calculateHabitIntakeDecision va qabul qaror qoidalarini tekshirish
{
  const existingHabits: Habit[] = [
    {
      id: 'h-creatine-1',
      title: 'Kreatin',
      category: 'odat',
      habitType: 'supplement_health',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 2,
      bestStreak: 5,
      history: {
        '2026-10-27': { completed: true },
        '2026-10-28': { completed: true },
      },
    },
  ];

  // 1. “kreatin” → qabul tanlandi: completion o‘zgarmaydi
  const decision1 = calculateHabitIntakeDecision(
    existingHabits,
    { title: 'Kreatin', markDoneToday: false },
    '2026-10-29'
  );
  assert(decision1.shouldMarkCompletion === false, 'p1) “kreatin” → qabul tanlandi: completion o‘zgarmaydi (shouldMarkCompletion: false)');
  assert(decision1.action === 'already_exists', 'p1) Mavjud odat bo‘lsa yangi nusxa yaratmasdan mavjudligini bildiradi');
  assert(!existingHabits[0].history['2026-10-29']?.completed, 'p1) Tarixda bugungi kun belgilanmagan holatda qoladi');

  // 2. markDoneToday=false: completion o‘zgarmaydi
  const decision2 = calculateHabitIntakeDecision(
    existingHabits,
    { title: 'Kreatin', markDoneToday: false },
    '2026-10-29'
  );
  assert(decision2.shouldMarkCompletion === false, 'p2) markDoneToday=false: completion o‘zgarmaydi');

  // 3. Tasdiqlangan bajarilish va aniq habit ID: bir marta belgilanadi
  const decision3 = calculateHabitIntakeDecision(
    existingHabits,
    { title: 'Kreatin', targetHabitId: 'h-creatine-1', markDoneToday: true },
    '2026-10-29'
  );
  assert(decision3.shouldMarkCompletion === true, 'p3) Tasdiqlangan bajarilishda shouldMarkCompletion true bo\'ladi');
  assert(decision3.action === 'mark_completed', 'p3) Aniq habit ID bo\'yicha mark_completed qaytariladi');

  const stateAfterDone = domainReducer(
    { activities: [], habits: existingHabits, goals: [] },
    {
      type: 'SET_HABIT_COMPLETION_TODAY',
      habitId: 'h-creatine-1',
      completed: true,
      dateStr: '2026-10-29',
      timestamp: '2026-10-29T11:00:00Z',
    }
  );
  assert(
    stateAfterDone.habits[0].history['2026-10-29']?.completed === true,
    'p3) Bugungi kunda bajarilgan deb saqlanadi'
  );
  assert(
    stateAfterDone.habits[0].streak === 3,
    'p3) Streak 2 dan 3 ga oshadi'
  );

  // 4. Ikki o‘xshash nom: avtomatik belgilash yo‘q
  const twoSimilarHabits: Habit[] = [
    {
      id: 'h-creatine-morning',
      title: 'Kreatin ertalab',
      category: 'odat',
      habitType: 'supplement_health',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 0,
      bestStreak: 0,
      history: {},
    },
    {
      id: 'h-creatine-evening',
      title: 'Kreatin kechqurun',
      category: 'odat',
      habitType: 'supplement_health',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 0,
      bestStreak: 0,
      history: {},
    },
  ];

  const decision4 = calculateHabitIntakeDecision(
    twoSimilarHabits,
    { title: 'Kreatin', markDoneToday: true },
    '2026-10-29'
  );
  assert(decision4.action === 'disambiguation_needed', 'p4) Ikki o‘xshash nom: disambiguation_needed qaytariladi');
  assert(decision4.shouldMarkCompletion === false, 'p4) Avtomatik belgilash yo\'q (shouldMarkCompletion: false)');
  if (decision4.action === 'disambiguation_needed') {
    assert(decision4.candidates.length === 2, 'p4) Ikkala nomzod ham tanlash uchun qaytariladi');
  }

  // 5. Arxivlangan odat: avtomatik belgilash yo‘q
  const archivedHabits: Habit[] = [
    {
      id: 'h-archived-creatine',
      title: 'Kreatin',
      category: 'odat',
      habitType: 'supplement_health',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 0,
      bestStreak: 0,
      history: {},
      isArchived: true,
    },
  ];

  const decision5 = calculateHabitIntakeDecision(
    archivedHabits,
    { title: 'Kreatin', markDoneToday: true },
    '2026-10-29'
  );
  assert(decision5.action === 'create_new', 'p5) Arxivlangan odat avtomatik tanlanmasdan yangi sifatida ko\'riladi');

  // 6. Bugun allaqachon bajarilgan odat: qayta tasdiqlash uni bekor qilmaydi
  const alreadyDoneHabit: Habit = {
    id: 'h-already-done',
    title: 'Kreatin',
    category: 'odat',
    habitType: 'supplement_health',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 4,
    bestStreak: 4,
    history: {
      '2026-10-29': { completed: true, timestamp: '2026-10-29T08:00:00Z' },
    },
  };

  const decision6 = calculateHabitIntakeDecision(
    [alreadyDoneHabit],
    { title: 'Kreatin', targetHabitId: 'h-already-done', markDoneToday: true },
    '2026-10-29'
  );
  assert(decision6.action === 'mark_completed', 'p6) mark_completed action qaytariladi');
  if (decision6.action === 'mark_completed') {
    assert(decision6.alreadyCompleted === true, 'p6) alreadyCompleted true deb aniqlanadi');
  }

  // Reducer ga qo'llanganda uni bekor qilmaydi (completed: true saqlanadi)
  const stateReconfirm = domainReducer(
    { activities: [], habits: [alreadyDoneHabit], goals: [] },
    {
      type: 'SET_HABIT_COMPLETION_TODAY',
      habitId: 'h-already-done',
      completed: true,
      dateStr: '2026-10-29',
      timestamp: '2026-10-29T12:00:00Z',
    }
  );
  assert(
    stateReconfirm.habits[0].history['2026-10-29']?.completed === true,
    'p6) Bugun allaqachon bajarilgan odat qayta tasdiqlanganda bekor bo\'lmaydi (completed: true saqlanadi)'
  );
  assert(
    stateReconfirm.habits[0].streak === 4,
    'p6) Streak 4 holida o\'zgarmay qoladi'
  );
}

// Test Q: calculateHabitIntakeDecision targetHabitId xatosi va 1 ta qisman moslik siyosati
{
  const habitGym: Habit = {
    id: 'h-zal',
    title: 'Zalga borish',
    category: 'odat',
    habitType: 'general',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 1,
    bestStreak: 1,
    history: {},
  };

  const habitArchived: Habit = {
    id: 'h-archived',
    title: 'Arxivlangan odat',
    category: 'odat',
    habitType: 'general',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 0,
    bestStreak: 0,
    history: {},
    isArchived: true,
  };

  // 1. targetHabitId berilgan, ammo topilmagan yoki arxivlangan -> xato qaytariladi, boshqa odatga fallback bo'lmaydi
  const decisionTargetNotFound = calculateHabitIntakeDecision(
    [habitGym, habitArchived],
    { title: 'Zalga borish', targetHabitId: 'h-not-found', markDoneToday: true },
    '2026-10-30'
  );
  assert(decisionTargetNotFound.action === 'error', 'q1) Topilmagan targetHabitId uchun aniq xato qaytariladi');
  assert(decisionTargetNotFound.shouldMarkCompletion === false, 'q1) shouldMarkCompletion false bo\'ladi');

  const decisionTargetArchived = calculateHabitIntakeDecision(
    [habitGym, habitArchived],
    { title: 'Arxivlangan odat', targetHabitId: 'h-archived', markDoneToday: true },
    '2026-10-30'
  );
  assert(decisionTargetArchived.action === 'error', 'q2) Arxivlangan targetHabitId uchun aniq xato qaytariladi');

  // 2. 1 ta qisman moslik (partial match length === 1): avtomatik mark_completed QILINMAYDI, tasdiqlash so'raladi
  const decisionPartialOne = calculateHabitIntakeDecision(
    [habitGym],
    { title: 'Zal', markDoneToday: true },
    '2026-10-30'
  );
  assert(decisionPartialOne.action === 'disambiguation_needed', 'q3) 1 ta qisman moslik avtomatik belgilamasdan tasdiqlash talab qiladi');
  assert(decisionPartialOne.shouldMarkCompletion === false, 'q3) shouldMarkCompletion false');
}

// Test R: validateActivity tekshiruvlari
{
  const todayStr = '2026-10-30';

  // Yaroqli faoliyat
  const validAct = validateActivity(
    {
      title: 'Suzish mashg\'uloti',
      localDate: '2026-10-30',
      category: 'sport',
      durationMinutes: 45,
      quantity: 1000,
    },
    todayStr
  );
  assert(validAct.isValid === true, 'r1) Yaroqli faoliyat tekshiruvdan muvaffaqiyatli o\'tadi');

  // Bo'sh sarlavha rad etiladi
  const emptyTitle = validateActivity(
    { title: '   ', localDate: '2026-10-30' },
    todayStr
  );
  assert(emptyTitle.isValid === false, 'r2) Bo\'sh sarlavha rad etiladi');

  // Noto'g'ri sana formati rad etiladi
  const invalidDate = validateActivity(
    { title: 'Yugurish', localDate: '2026-02-31' },
    todayStr
  );
  assert(invalidDate.isValid === false, 'r3) Kalendarda yo\'q sana rad etiladi');

  // Kelajakdagi sana rad etiladi!
  const futureDate = validateActivity(
    { title: 'Ertaga yugurish', localDate: '2026-10-31' },
    todayStr
  );
  assert(futureDate.isValid === false, 'r4) Kelajak sanasiga kiritilgan faoliyat rad etiladi');

  // Musbat bo'lmagan yoki cheksiz davomiylik rad etiladi
  const badDur = validateActivity(
    { title: 'Zal', localDate: '2026-10-30', durationMinutes: -10 },
    todayStr
  );
  assert(badDur.isValid === false, 'r5) Manfiy davomiylik rad etiladi');

  const infDur = validateActivity(
    { title: 'Zal', localDate: '2026-10-30', durationMinutes: Infinity },
    todayStr
  );
  assert(infDur.isValid === false, 'r6) Cheksiz davomiylik rad etiladi');

  // Musbat bo'lmagan miqdor rad etiladi
  const zeroQty = validateActivity(
    { title: 'Kitob', localDate: '2026-10-30', quantity: 0 },
    todayStr
  );
  assert(zeroQty.isValid === false, 'r7) 0 miqdor rad etiladi');
}

// Test S: Sarhisob (calculateCalendarPeriodSummary) va deduplikatsiya
{
  const refDate = '2026-10-30'; // Juma

  // Hafta chegaralari: Du (2026-10-26) .. Ya (2026-11-01)
  const weekBounds = getCalendarPeriodBounds('hafta', refDate);
  assert(weekBounds.startDate === '2026-10-26', 's1) Hafta boshi dushanba 2026-10-26');
  assert(weekBounds.endDate === '2026-11-01', 's1) Hafta oxiri yakshanba 2026-11-01');

  // Oy chegaralari
  const monthBounds = getCalendarPeriodBounds('oy', refDate);
  assert(monthBounds.startDate === '2026-10-01', 's2) Oy boshi 2026-10-01');
  assert(monthBounds.endDate === '2026-10-31', 's2) Oy oxiri 2026-10-31');

  // Faoliyatlar:
  // 1. Sport (Zal) - 60 daqiqa, linked to habit 'h-gym' on 2026-10-28
  // 2. Sport (Yugurish) - 30 daqiqa, 5 km on 2026-10-28 (ayni kunda ikkinchi faoliyat!)
  // 3. Ta'lim (Kitob) - davomiyliksiz, 40 bet on 2026-10-29
  const testActivities: Activity[] = [
    {
      id: 'act-1',
      title: 'Zalga bordim',
      localDate: '2026-10-28',
      category: 'sport',
      durationMinutes: 60,
      linkedHabitId: 'h-gym',
      source: 'manual',
      createdAt: '2026-10-28T10:00:00Z',
    },
    {
      id: 'act-2',
      title: 'Yugurdim',
      localDate: '2026-10-28',
      category: 'sport',
      durationMinutes: 30,
      quantity: 5,
      unit: 'km',
      source: 'manual',
      createdAt: '2026-10-28T18:00:00Z',
    },
    {
      id: 'act-3',
      title: 'Kitob mutolaasi',
      localDate: '2026-10-29',
      category: 'talim',
      quantity: 40,
      unit: 'bet',
      source: 'manual',
      createdAt: '2026-10-29T20:00:00Z',
    },
  ];

  // Odatlar:
  // 'h-gym': 2026-10-28 da bajarilgan (lekin act-1 unga bog'langan, deduplikatsiya qilinishi kerak!)
  // 'h-meditation': 2026-10-27 da standalone bajarilgan (hech qanday faoliyat unga bog'lanmagan)
  const testHabits: Habit[] = [
    {
      id: 'h-gym',
      title: 'Zal mashg\'uloti',
      category: 'odat',
      habitType: 'general',
      frequency: 'weekly_target',
      targetDaysPerWeek: 3,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 1,
      bestStreak: 1,
      history: {
        '2026-10-28': { completed: true, timestamp: '2026-10-28T10:00:00Z' },
      },
    },
    {
      id: 'h-meditation',
      title: 'Meditatsiya',
      category: 'odat',
      habitType: 'general',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 1,
      bestStreak: 1,
      history: {
        '2026-10-27': { completed: true, timestamp: '2026-10-27T08:00:00Z' },
      },
    },
  ];

  const testTasks: Task[] = [
    {
      id: 't-1',
      title: 'Hisobot topshirildi',
      category: 'vazifa',
      date: '2026-10-27',
      status: 'completed',
      priority: 'high',
      source: 'miniapp',
    },
  ];

  const summary = calculateCalendarPeriodSummary(
    testActivities,
    testHabits,
    testTasks,
    'hafta',
    refDate
  );

  assert(summary.totalActivities === 3, 's3) Jami faoliyatlar soni 3 ta');
  // 2026-10-28 (2 ta faoliyat) va 2026-10-29 (1 ta faoliyat) -> 2 ta faol kun!
  assert(summary.activeDaysCount === 2, 's3) Faoliyatlar bo\'yicha faol kunlar soni 2 ta (ayni kundagi bir nechta mashq 1 faol kun sanaladi)');
  assert(summary.totalDurationMinutes === 90, 's3) Jami vaqt 60 + 30 = 90 daqiqa (kitob uchun soxta vaqt o\'ylab topilmagan)');
  assert(summary.durationsCount === 2, 's3) Davomiyligi bor yozuvlar soni 2 ta');

  // Miqdorlar alohida birlik bo'yicha guruhlangan: km va bet hech qachon qo'shilmaydi!
  assert(summary.unitQuantities['km'] === 5, 's4) km miqdori 5');
  assert(summary.unitQuantities['bet'] === 40, 's4) bet miqdori 40');

  // Deduplikatsiya: h-gym 2026-10-28 da act-1 ga bog'langanligi sababli standalone habit sifatida qayta hisoblanmaydi!
  // Faqat h-meditation (2026-10-27) standalone habit sanaladi:
  assert(summary.standaloneHabitCompletions === 1, 's5) Bog\'langan odat deduplikatsiya qilindi, faqat 1 ta standalone odat hisoblandi');
  assert(summary.completedTasksCount === 1, 's5) Bajarilgan vazifalar soni 1 ta');
}

// Test T: getPreviousDayOfWeekYMD
{
  const refDate = '2026-10-30'; // 2026-10-30 is Juma (5)
  // Yakshanba (7): eng oxirgi o'tgan yakshanba -> 2026-10-25
  const prevSunday = getPreviousDayOfWeekYMD(refDate, 7);
  assert(prevSunday === '2026-10-25', 't1) 2026-10-30 Jumadan oldingi yakshanba 2026-10-25');
  assert(prevSunday < refDate, 't1) Natija doimo o\'tgan sana bo\'ladi');

  // Dushanba (1): 2026-10-26
  const prevMonday = getPreviousDayOfWeekYMD(refDate, 1);
  assert(prevMonday === '2026-10-26', 't2) 2026-10-30 Jumadan oldingi dushanba 2026-10-26');
}

// ============================================================================
// SECTION 6: Production oqimini tekshiradigan testlar
// ============================================================================

// Test U: Qo‘lda 10 bet + faoliyatdan 20 bet = 30; faoliyat o‘chirilsa 10 qoladi
{
  const habitBook: Habit = {
    id: 'h-book-prod',
    title: 'Kitob o\'qish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 25,
    unit: 'bet',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  let state: DomainState = {
    activities: [],
    habits: [habitBook],
    goals: [],
  };

  // 1. Qo'lda 10 bet kiritish
  state = domainReducer(state, {
    type: 'LOG_HABIT_QUANTITY',
    habitId: 'h-book-prod',
    amount: 10,
    dateStr: '2026-10-30',
    timestamp: '2026-10-30T10:00:00Z',
  });

  assert(state.habits[0].history['2026-10-30']?.quantity === 10, 'u1) Qo\'lda 10 bet kiritildi');
  assert(state.habits[0].history['2026-10-30']?.completed === false, 'u1) 10 < 25 bo\'lgani uchun hali completed false');

  // 2. Faoliyat orqali 20 bet qo'shish
  const actBook: Activity = {
    id: 'act-book-1',
    title: 'Kechki mutolaa',
    localDate: '2026-10-30',
    category: 'talim',
    quantity: 20,
    unit: 'bet',
    linkedHabitId: 'h-book-prod',
    source: 'manual',
    createdAt: '2026-10-30T19:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actBook,
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-30']?.quantity === 30, 'u2) 10 + 20 = 30 bet bo\'ldi');
  assert(state.habits[0].history['2026-10-30']?.completed === true, 'u2) 30 >= 25 bo\'lgani uchun completed true');
  assert(state.activities.length === 1, 'u2) Faoliyatlar ro\'yxatida 1 ta yozuv mavjud');

  // 3. Faoliyat o'chirilsa, aynan uning 20 bet hissasi olinib, qo'lda kiritilgan 10 bet qoladi
  state = domainReducer(state, {
    type: 'DELETE_ACTIVITY',
    id: 'act-book-1',
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-30']?.quantity === 10, 'u3) Faoliyat o\'chirilgach, qo\'lda kiritilgan 10 bet saqlanib qoldi');
  assert(state.habits[0].history['2026-10-30']?.completed === false, 'u3) 10 < 25 bo\'lgani uchun completed false ga qaytdi');
  assert(state.activities.length === 0, 'u3) Faoliyat o\'chirildi');
}

// Test V: Oldindan qo‘lda bajarilgan miqdorsiz odat, bog‘langan faoliyat qo‘shilib/o‘chirilganda bajarilganligicha qoladi
{
  const habitGym: Habit = {
    id: 'h-gym-prod',
    title: 'Zal mashg\'uloti',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  let state: DomainState = {
    activities: [],
    habits: [habitGym],
    goals: [],
  };

  // 1. Foydalanuvchi odatni qo'lda checkbox orqali bajardi deb belgiladi
  state = domainReducer(state, {
    type: 'SET_HABIT_COMPLETION_TODAY',
    habitId: 'h-gym-prod',
    completed: true,
    dateStr: '2026-10-30',
    timestamp: '2026-10-30T09:00:00Z',
  });

  assert(state.habits[0].history['2026-10-30']?.completed === true, 'v1) Odat qo\'lda bajarilgan deb belgilandi');

  // 2. Bog'langan faoliyat qo'shildi
  const actGym: Activity = {
    id: 'act-gym-1',
    title: 'Katta mashg\'ulot',
    localDate: '2026-10-30',
    category: 'sport',
    durationMinutes: 60,
    linkedHabitId: 'h-gym-prod',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actGym,
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-30']?.completed === true, 'v2) Faoliyat qo\'shilgach ham bajarilgan');

  // 3. Faoliyat o'chirilsa, oldindan qo'lda belgilangan bajarilganlik yo'qolmaydi!
  state = domainReducer(state, {
    type: 'DELETE_ACTIVITY',
    id: 'act-gym-1',
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-30']?.completed === true, 'v3) Faoliyat o\'chirilgach, qo\'lda bajarilganlik saqlanib qoldi!');

  // Kontrast holat: agar qo'lda bajarilmagan bo'lsa (manualCompleted = false)
  const actGym2: Activity = {
    id: 'act-gym-2',
    title: 'Kechki yugurish',
    localDate: '2026-10-29',
    category: 'sport',
    durationMinutes: 30,
    linkedHabitId: 'h-gym-prod',
    source: 'manual',
    createdAt: '2026-10-29T18:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actGym2,
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-29']?.completed === true, 'v4) 29-kunda faoliyat hisobiga completed true bo\'ldi');

  state = domainReducer(state, {
    type: 'DELETE_ACTIVITY',
    id: 'act-gym-2',
    dateStr: '2026-10-30',
  });

  assert(state.habits[0].history['2026-10-29']?.completed === false, 'v5) Faoliyat o\'chirilgach, avval qo\'lda kiritilmagan kun completed false ga qaytdi');
}

// Test W: Quantity edit, date change, relink va unlink hissani to‘g‘ri ko‘chiradi
{
  const habitA: Habit = {
    id: 'h-A',
    title: 'Odat A',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 50,
    unit: 'bet',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  const habitB: Habit = {
    id: 'h-B',
    title: 'Odat B',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 50,
    unit: 'bet',
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  let state: DomainState = {
    activities: [],
    habits: [habitA, habitB],
    goals: [],
  };

  // Habit A ga 2026-10-28 sanasida qo'lda 10 bet
  state = domainReducer(state, {
    type: 'LOG_HABIT_QUANTITY',
    habitId: 'h-A',
    amount: 10,
    dateStr: '2026-10-28',
    timestamp: '2026-10-28T09:00:00Z',
  });

  // Faoliyat qo'shiladi: Habit A ga 20 bet (jami 30)
  const act: Activity = {
    id: 'act-transfer',
    title: 'O\'qish',
    localDate: '2026-10-28',
    category: 'talim',
    quantity: 20,
    unit: 'bet',
    linkedHabitId: 'h-A',
    source: 'manual',
    createdAt: '2026-10-28T10:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: act,
    dateStr: '2026-10-30',
  });

  const getH = (id: string) => state.habits.find(h => h.id === id)!;
  assert(getH('h-A').history['2026-10-28']?.quantity === 30, 'w1) Boshlang\'ich: 10 + 20 = 30');

  // 1. Quantity edit: miqdorni 20 dan 25 ga oshirish
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-transfer',
    updates: { quantity: 25 },
    dateStr: '2026-10-30',
  });
  assert(getH('h-A').history['2026-10-28']?.quantity === 35, 'w2) Miqdor tahrirlangach: 10 + 25 = 35');

  // 2. Date change: sanani 2026-10-28 dan 2026-10-29 ga ko'chirish
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-transfer',
    updates: { localDate: '2026-10-29' },
    dateStr: '2026-10-30',
  });
  assert(getH('h-A').history['2026-10-28']?.quantity === 10, 'w3) 28-sanada yana faqat qo\'lda kiritilgan 10 bet qoldi');
  assert(getH('h-A').history['2026-10-29']?.quantity === 25, 'w3) 29-sanaga 25 bet muvaffaqiyatli ko\'chdi');

  // 3. Relink: Habit A dan Habit B ga qayta bog'lash
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-transfer',
    updates: { linkedHabitId: 'h-B' },
    dateStr: '2026-10-30',
  });
  assert((getH('h-A').history['2026-10-29']?.quantity || 0) === 0, 'w4) Habit A ning 29-sanasidan hissa olib tashlandi');
  assert(getH('h-B').history['2026-10-29']?.quantity === 25, 'w4) Habit B ning 29-sanasiga 25 bet qo\'shildi');

  // 4. Unlink: Bog'lanishni butunlay olib tashlash (linkedHabitId: null)
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-transfer',
    updates: { linkedHabitId: null },
    dateStr: '2026-10-30',
  });
  assert((getH('h-B').history['2026-10-29']?.quantity || 0) === 0, 'w5) Unlink qilinganda Habit B dan hissa olindi');
}

// Test X: Bog‘langan maqsadga faqat haqiqiy farq qo‘llanadi
{
  const goalBooks: Goal = {
    id: 'g-books',
    title: '300 bet o\'qish',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 300,
    currentValue: 100, // oldingi boshqa progress
    unit: 'bet',
    linkedHabitIds: ['h-read'],
    status: 'active',
  };

  const habitRead: Habit = {
    id: 'h-read',
    title: 'Kitob',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 20,
    unit: 'bet',
    streak: 0,
    bestStreak: 0,
    linkedGoalId: 'g-books',
    history: {},
  };

  let state: DomainState = {
    activities: [],
    habits: [habitRead],
    goals: [goalBooks],
  };

  // 1. Faoliyat orqali 20 bet qo'shiladi -> Maqsad 100 + 20 = 120
  const actRead: Activity = {
    id: 'act-read-1',
    title: 'Mutolaa',
    localDate: '2026-10-30',
    category: 'talim',
    quantity: 20,
    unit: 'bet',
    linkedHabitId: 'h-read',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actRead,
    dateStr: '2026-10-30',
  });

  assert(state.goals[0].currentValue === 120, 'x1) Maqsad qiymati 100 + 20 = 120 bo\'ldi');

  // 2. Faoliyat miqdori 20 dan 35 ga o'zgartiriladi -> Farq +15 -> Maqsad 120 + 15 = 135
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-read-1',
    updates: { quantity: 35 },
    dateStr: '2026-10-30',
  });

  assert(state.goals[0].currentValue === 135, 'x2) Maqsadga faqat haqiqiy farq (+15) qo\'llanib, 135 bo\'ldi');

  // 3. Faoliyat o'chiriladi -> 35 to'liq qaytariladi -> Maqsad 100 ga qaytadi
  state = domainReducer(state, {
    type: 'DELETE_ACTIVITY',
    id: 'act-read-1',
    dateStr: '2026-10-30',
  });

  assert(state.goals[0].currentValue === 100, 'x3) Faoliyat o\'chirilgach, maqsad 100 ga qaytdi');
}

// Test Y: Bir operationId ikki marta yuborilganda bitta yozuv
{
  let state: DomainState = {
    activities: [],
    habits: [],
    goals: [],
  };

  const actDup: Activity = {
    id: 'act-dup-1',
    operationId: 'op-stable-123',
    title: 'Zal mashqi',
    localDate: '2026-10-30',
    category: 'sport',
    durationMinutes: 45,
    source: 'bot',
    createdAt: '2026-10-30T11:00:00Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actDup,
    dateStr: '2026-10-30',
  });

  assert(state.activities.length === 1, 'y1) Birinchi marta qo\'shilganda 1 ta faoliyat yaratildi');

  // Bir xil operationId bilan qayta yuborilganda dublikat qo'shilmaydi
  const actDup2: Activity = {
    id: 'act-dup-2', // ID har xil bo'lsa ham
    operationId: 'op-stable-123', // operationId bir xil!
    title: 'Zal mashqi',
    localDate: '2026-10-30',
    category: 'sport',
    durationMinutes: 45,
    source: 'bot',
    createdAt: '2026-10-30T11:00:01Z',
  };

  state = domainReducer(state, {
    type: 'ADD_ACTIVITY',
    activity: actDup2,
    dateStr: '2026-10-30',
  });

  assert(state.activities.length === 1, 'y2) Bir xil operationId qayta yuborilganda dublikat yozuv qo\'shilmadi');
}

// Test Z: Bir kunda ikki alohida mashg‘ulot (2 faoliyat, 1 faol kun)
{
  const actM1: Activity = {
    id: 'act-m1',
    operationId: 'op-m1',
    title: 'Ertalabki yugurish',
    localDate: '2026-10-30',
    category: 'sport',
    durationMinutes: 30,
    source: 'manual',
    createdAt: '2026-10-30T07:00:00Z',
  };

  const actM2: Activity = {
    id: 'act-m2',
    operationId: 'op-m2',
    title: 'Kechki suzish',
    localDate: '2026-10-30',
    category: 'sport',
    durationMinutes: 45,
    source: 'manual',
    createdAt: '2026-10-30T19:00:00Z',
  };

  let state: DomainState = {
    activities: [],
    habits: [],
    goals: [],
  };

  state = domainReducer(state, { type: 'ADD_ACTIVITY', activity: actM1, dateStr: '2026-10-30' });
  state = domainReducer(state, { type: 'ADD_ACTIVITY', activity: actM2, dateStr: '2026-10-30' });

  assert(state.activities.length === 2, 'z1) Ikkala alohida mashg\'ulot ham saqlandi');

  const summary = calculateCalendarPeriodSummary(
    state.activities,
    state.habits,
    [],
    'hafta',
    '2026-10-30'
  );

  assert(summary.totalActivities === 2, 'z2) Jami faoliyatlar soni 2 ta');
  assert(summary.activeDaysCount === 1, 'z2) Bir kundagi 2 mashg\'ulot aynan 1 faol kun sanaladi');
  assert(summary.totalDurationMinutes === 75, 'z2) Jami davomiylik 30 + 45 = 75 daqiqa');
}

// Test AA: Reja sanasi va haqiqiy bajarilish sanasi farqi
{
  // Vazifa 2026-10-20 ga rejalashtirilgan, lekin 2026-10-25 da bajarilgan
  const taskLate: Task = {
    id: 'task-late-1',
    title: 'Kechikkan hisobot',
    category: 'vazifa',
    date: '2026-10-20',
    status: 'completed',
    completedAt: '2026-10-25T08:30:00.000Z',
    priority: 'high',
    source: 'miniapp',
  };

  const compDate = getTaskCompletionDateInTimezone(taskLate, 'Asia/Tashkent (UTC+5)');
  assert(compDate === '2026-10-25', 'aa1) Haqiqiy bajarilish sanasi 2026-10-25 bo\'yicha hisoblandi');
  assert(compDate !== taskLate.date, 'aa1) Reja sanasi (2026-10-20) bilan haqiqiy bajarilish sanasi (2026-10-25) farqi aniqlandi');

  // Eski completedAt bo'lmagan yozuvlar uchun fallback
  const legacyTask: Task = {
    id: 'task-legacy',
    title: 'Eski vazifa',
    category: 'vazifa',
    date: '2026-10-22',
    status: 'completed',
    priority: 'medium',
    source: 'miniapp',
  };

  const legacyCompDate = getTaskCompletionDateInTimezone(legacyTask, 'Asia/Tashkent');
  assert(legacyCompDate === '2026-10-22', 'aa2) completedAt yo\'q eski yozuv reja sanasiga (date) fallback qiladi');
}

// Test AB: linkedTaskId bo‘yicha ikki marta sanamaslik
{
  const taskDone: Task = {
    id: 't-meeting-1',
    title: 'Mijoz bilan uchrashuv',
    category: 'vazifa',
    date: '2026-10-30',
    status: 'completed',
    completedAt: '2026-10-30T10:00:00Z',
    priority: 'high',
    source: 'miniapp',
  };

  const actMeeting: Activity = {
    id: 'act-meet-1',
    title: 'Mijoz bilan uchrashuv o\'tkazildi',
    localDate: '2026-10-30',
    category: 'ish',
    durationMinutes: 60,
    linkedTaskId: 't-meeting-1',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  const summary = calculateCalendarPeriodSummary(
    [actMeeting],
    [],
    [taskDone],
    'hafta',
    '2026-10-30'
  );

  assert(summary.totalActivities === 1, 'ab1) Faoliyatlar soni 1 ta');
  assert(summary.completedTasksCount === 0, 'ab1) linkedTaskId tufayli bajarilgan vazifa alohida takror sanalmadi (0 ta standalone)');
  assert(summary.totalEventsCount === 1, 'ab1) Jami voqealar soni 1 ta (ikki marta hisoblanmadi)');
}

// Test AC: Noto‘g‘ri edit va import barcha state’ni o‘z holatida qoldirishi
{
  const habitGym: Habit = {
    id: 'h-gym-ac',
    title: 'Zal',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: false,
    streak: 0,
    bestStreak: 0,
    history: {},
  };

  const actValid: Activity = {
    id: 'act-valid-1',
    title: 'Mashg\'ulot',
    localDate: '2026-10-29',
    category: 'sport',
    durationMinutes: 50,
    linkedHabitId: 'h-gym-ac',
    source: 'manual',
    createdAt: '2026-10-29T10:00:00Z',
  };

  let state: DomainState = {
    activities: [actValid],
    habits: [habitGym],
    goals: [],
  };

  // 1. Noto'g'ri edit: kelajak sanasini qo'yish (masalan 2099-01-01)
  const stateFuture = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-valid-1',
    updates: { localDate: '2099-01-01' },
    dateStr: '2026-10-30',
  });
  assert(stateFuture === state, 'ac1) Kelajak sanasiga tahrirlash rad etildi, state o\'z holatida qoldi');

  // 2. Noto'g'ri edit: manfiy davomiylik
  const stateNeg = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-valid-1',
    updates: { durationMinutes: -30 },
    dateStr: '2026-10-30',
  });
  assert(stateNeg === state, 'ac2) Manfiy davomiylik rad etildi, state o\'z holatida qoldi');

  // 3. Noto'g'ri edit: mavjud bo'lmagan odatga bog'lash
  const stateNoHabit = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-valid-1',
    updates: { linkedHabitId: 'non-existent-habit' },
    dateStr: '2026-10-30',
  });
  assert(stateNoHabit === state, 'ac3) Mavjud bo\'lmagan odatga bog\'lash rad etildi, state o\'z holatida qoldi');

  // 4. validateActivity testlari:
  const v1 = validateActivity({ title: 'Test', localDate: '2026-02-31' }, '2026-10-30');
  assert(!v1.isValid, 'ac4) Mavjud bo\'lmagan kalendar sanasi (2026-02-31) rad etildi');

  const v2 = validateActivity({ title: 'Test', localDate: '2026-10-30', time: '25:99' }, '2026-10-30');
  assert(!v2.isValid, 'ac5) Noto\'g\'ri vaqt formati (25:99) rad etildi');

  const v3 = validateActivity({ title: 'Test', localDate: '2026-10-30', time: '14:30' }, '2026-10-30');
  assert(v3.isValid, 'ac6) To\'g\'ri vaqt formati (14:30) qabul qilindi');
}

// ============================================================================
// TEST SUITE AD: UPDATE_ACTIVITY Maqsadga Net Delta Bir Marta Qo'llanishi
// ============================================================================

// ad1) Maqsad qiymati 0 chegarasida activity title-only edit
{
  const habitA: Habit = {
    id: 'habit-ad1',
    title: 'Kitob o\'qish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 20,
    unit: 'bet',
    streak: 5,
    bestStreak: 10,
    linkedGoalId: 'goal-ad1',
    history: {
      '2026-10-30': {
        completed: true,
        quantity: 20,
        activityContributions: {
          'act-ad1': { quantity: 20, timestamp: '2026-10-30T10:00:00Z' },
        },
      },
    },
  };

  const goalA: Goal = {
    id: 'goal-ad1',
    title: '300 bet kitob',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 300,
    currentValue: 0, // Chegara holati: 0 qiymat
    unit: 'bet',
    linkedHabitIds: ['habit-ad1'],
    status: 'active',
  };

  const actA: Activity = {
    id: 'act-ad1',
    title: 'Eski kitob nomi',
    localDate: '2026-10-30',
    category: 'talim',
    quantity: 20,
    unit: 'bet',
    linkedHabitId: 'habit-ad1',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  const state: DomainState = {
    activities: [actA],
    habits: [habitA],
    goals: [goalA],
  };

  // Faqat title va notes o'zgaradi
  const updatedState = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-ad1',
    updates: { title: 'Yangi kitob nomi', notes: 'Qiziqarli bob' },
    dateStr: '2026-10-30',
  });

  assert(
    updatedState.goals[0].currentValue === 0,
    'ad1) Maqsad qiymati 0 bo\'lganda title edit uni korruptsiya qilmaydi (currentValue 0 saqlanadi)'
  );
  assert(
    updatedState.habits[0].streak === 5 && updatedState.habits[0].bestStreak === 10,
    'ad1) Odat streak va bestStreak title edit tufayli sun\'iy o\'zgarmaydi'
  );
  assert(
    updatedState.activities[0].title === 'Yangi kitob nomi',
    'ad1) Faoliyat sarlavhasi yangilandi'
  );
}

// ad2) Bir xil activity'ni o'zgarishsiz update qilish
{
  const habitA: Habit = {
    id: 'habit-ad2',
    title: 'Suv ichish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    targetQuantity: 2000,
    unit: 'ml',
    streak: 3,
    bestStreak: 7,
    linkedGoalId: 'goal-ad2',
    history: {
      '2026-10-30': {
        completed: true,
        quantity: 500,
        activityContributions: {
          'act-ad2': { quantity: 500, timestamp: '2026-10-30T10:00:00Z' },
        },
      },
    },
  };

  const goalA: Goal = {
    id: 'goal-ad2',
    title: 'Kundalik suv',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 2000,
    currentValue: 500,
    unit: 'ml',
    linkedHabitIds: ['habit-ad2'],
    status: 'active',
  };

  const actA: Activity = {
    id: 'act-ad2',
    title: 'Suv',
    localDate: '2026-10-30',
    category: 'salomatlik',
    quantity: 500,
    unit: 'ml',
    linkedHabitId: 'habit-ad2',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  const state: DomainState = {
    activities: [actA],
    habits: [habitA],
    goals: [goalA],
  };

  const updatedState = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-ad2',
    updates: { quantity: 500 }, // Ayni miqdor, hech narsa o'zgarmagan
    dateStr: '2026-10-30',
  });

  assert(
    updatedState.goals[0].currentValue === 500,
    'ad2) O\'zgarishsiz update qilishda maqsad qiymati aynan saqlanadi'
  );
  assert(
    updatedState.habits[0].history['2026-10-30'].quantity === 500,
    'ad2) Odat tarixi o\'zgarmaydi'
  );
}

// ad3) Bir maqsadga bog'langan ikki odat orasida teng miqdorli relink (net delta 0)
{
  const goalCommon: Goal = {
    id: 'goal-common',
    title: 'Yugurish jami',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 100,
    currentValue: 0, // Chegara: 0
    unit: 'km',
    linkedHabitIds: ['habit-run-morning', 'habit-run-evening'],
    status: 'active',
  };

  const habitMorning: Habit = {
    id: 'habit-run-morning',
    title: 'Ertalabki yugurish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    unit: 'km',
    streak: 2,
    bestStreak: 5,
    linkedGoalId: 'goal-common',
    history: {
      '2026-10-30': {
        completed: true,
        quantity: 5,
        activityContributions: {
          'act-run': { quantity: 5, timestamp: '2026-10-30T07:00:00Z' },
        },
      },
    },
  };

  const habitEvening: Habit = {
    id: 'habit-run-evening',
    title: 'Kechki yugurish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    unit: 'km',
    streak: 0,
    bestStreak: 2,
    linkedGoalId: 'goal-common',
    history: {},
  };

  const actRun: Activity = {
    id: 'act-run',
    title: 'Yugurish',
    localDate: '2026-10-30',
    category: 'sport',
    quantity: 5,
    unit: 'km',
    linkedHabitId: 'habit-run-morning',
    source: 'manual',
    createdAt: '2026-10-30T07:00:00Z',
  };

  const state: DomainState = {
    activities: [actRun],
    habits: [habitMorning, habitEvening],
    goals: [goalCommon],
  };

  // Faoliyatni morning habitidan evening habitiga o'tkazamiz (relink)
  const updatedState = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-run',
    updates: { linkedHabitId: 'habit-run-evening' },
    dateStr: '2026-10-30',
  });

  const updatedGoal = updatedState.goals.find(g => g.id === 'goal-common')!;
  const updatedMorning = updatedState.habits.find(h => h.id === 'habit-run-morning')!;
  const updatedEvening = updatedState.habits.find(h => h.id === 'habit-run-evening')!;

  assert(
    updatedGoal.currentValue === 0,
    'ad3) Bir maqsadga bog\'langan odatlar orasida teng miqdorli relinkda net delta 0 bo\'lib, maqsad 0 chegarasida korruptsiya bo\'lmaydi'
  );
  assert(
    (updatedMorning.history['2026-10-30']?.quantity || 0) === 0,
    'ad3) Eski odatdan hissa olib tashlandi (quantity 0)'
  );
  assert(
    updatedEvening.history['2026-10-30']?.quantity === 5,
    'ad3) Yangi odatga hissa qo\'shildi (quantity 5)'
  );
}

// ad4) Sana o'zgarishi, miqdor oshishi/kamayishi va decrease maqsadi
{
  const goalDecrease: Goal = {
    id: 'goal-weight',
    title: 'Vazn kamaytirish',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 70,
    currentValue: 80, // Kamaytirish kerak: har faoliyat currentValue ni kamaytiradi
    goalType: 'decrease',
    unit: 'mashq',
    linkedHabitIds: ['habit-workout'],
    status: 'active',
  };

  const habitWorkout: Habit = {
    id: 'habit-workout',
    title: 'Mashq qilish',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    unit: 'mashq',
    streak: 1,
    bestStreak: 3,
    linkedGoalId: 'goal-weight',
    history: {
      '2026-10-28': {
        completed: true,
        quantity: 2,
        activityContributions: {
          'act-wk': { quantity: 2, timestamp: '2026-10-28T10:00:00Z' },
        },
      },
    },
  };

  const actWk: Activity = {
    id: 'act-wk',
    title: 'Kardio mashq',
    localDate: '2026-10-28',
    category: 'sport',
    quantity: 2,
    unit: 'mashq',
    linkedHabitId: 'habit-workout',
    source: 'manual',
    createdAt: '2026-10-28T10:00:00Z',
  };

  let state: DomainState = {
    activities: [actWk],
    habits: [habitWorkout],
    goals: [goalDecrease],
  };

  // 1. Miqdorni 2 dan 5 ga oshirish (delta +3): decrease goal uchun 80 - 3 = 77 bo'lishi kerak
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-wk',
    updates: { quantity: 5 },
    dateStr: '2026-10-30',
  });
  assert(
    state.goals[0].currentValue === 77,
    'ad4) Decrease goal: miqdor oshganda (2 -> 5) maqsad qiymati 80 - 3 = 77 ga kamayadi'
  );

  // 2. Miqdorni 5 dan 3 ga kamaytirish (delta -2): decrease goal uchun 77 - (-2) = 79 bo'lishi kerak
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-wk',
    updates: { quantity: 3 },
    dateStr: '2026-10-30',
  });
  assert(
    state.goals[0].currentValue === 79,
    'ad4) Decrease goal: miqdor kamayganda (5 -> 3) maqsad qiymati 77 + 2 = 79 ga qaytadi'
  );

  // 3. Sanani o'zgartirish (2026-10-28 dan 2026-10-29 ga, miqdor 3 o'zgarmagan):
  // Eski sanadan -3 olib tashlanadi, yangi sanaga +3 qo'shiladi -> net delta = 0!
  state = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-wk',
    updates: { localDate: '2026-10-29' },
    dateStr: '2026-10-30',
  });
  assert(
    state.goals[0].currentValue === 79,
    'ad4) Sana o\'zgarganda miqdor teng bo\'lgani uchun maqsad qiymati 79 holida aynan saqlanadi'
  );
  assert(
    (state.habits[0].history['2026-10-28']?.quantity || 0) === 0,
    'ad4) Eski sanadagi hissa tozalangan'
  );
  assert(
    state.habits[0].history['2026-10-29']?.quantity === 3,
    'ad4) Yangi sanadagi hissa saqlangan'
  );
}

// ad5) Net delta 0 bo'lsa goal qiymati aynan saqlanishi
{
  const goalP: Goal = {
    id: 'goal-p',
    title: 'Kitob mutolaasi',
    category: 'maqsad',
    deadline: '2026-12-31',
    targetValue: 500,
    currentValue: 120,
    unit: 'bet',
    linkedHabitIds: ['habit-read-1'],
    status: 'active',
  };

  const habitRead: Habit = {
    id: 'habit-read-1',
    title: 'Kitob',
    category: 'odat',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    hasQuantity: true,
    unit: 'bet',
    streak: 1,
    bestStreak: 1,
    linkedGoalId: 'goal-p',
    history: {
      '2026-10-30': {
        completed: true,
        quantity: 15,
        activityContributions: {
          'act-rd': { quantity: 15, timestamp: '2026-10-30T10:00:00Z' },
        },
      },
    },
  };

  const actRd: Activity = {
    id: 'act-rd',
    title: 'Kitob',
    localDate: '2026-10-30',
    category: 'talim',
    quantity: 15,
    unit: 'bet',
    linkedHabitId: 'habit-read-1',
    source: 'manual',
    createdAt: '2026-10-30T10:00:00Z',
  };

  const state: DomainState = {
    activities: [actRd],
    habits: [habitRead],
    goals: [goalP],
  };

  const updatedState = domainReducer(state, {
    type: 'UPDATE_ACTIVITY',
    id: 'act-rd',
    updates: { quantity: 15, durationMinutes: 45 },
    dateStr: '2026-10-30',
  });

  assert(
    updatedState.goals[0].currentValue === 120,
    'ad5) Net delta 0 bo\'lganda goal currentValue aynan 120 saqlanadi'
  );
  assert(
    updatedState.goals[0] === goalP,
    'ad5) Net delta 0 bo\'lganda goal ob\'ekti keraksiz mutatsiya qilinmasdan referensi saqlanadi'
  );
}

// ============================================================================
// TEST SUITE AE: parseAndValidateBackup Strict Candidate-State Import Validation
// ============================================================================

const dummyContext: BackupValidationContext = {
  todayStr: '2026-10-30',
  currentTasks: [
    {
      id: 'task-1',
      title: 'Hisobot tayyorlash',
      category: 'vazifa',
      date: '2026-10-30',
      status: 'pending',
      priority: 'high',
      source: 'bot',
    },
  ],
  currentHabits: [
    {
      id: 'habit-1',
      title: 'Ertalabki badantarbiya',
      category: 'odat',
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      hasQuantity: false,
      streak: 3,
      bestStreak: 5,
      history: {
        '2026-10-30': {
          completed: true,
          activityContributions: {
            'act-1': { timestamp: '2026-10-30T07:00:00Z' },
          },
        },
      },
    },
  ],
  currentGoals: [
    {
      id: 'goal-1',
      title: 'Sog\'lom hayot',
      category: 'maqsad',
      deadline: '2026-12-31',
      targetValue: 100,
      currentValue: 10,
      unit: 'marta',
      linkedHabitIds: ['habit-1'],
      status: 'active',
    },
  ],
  currentExpenses: [
    {
      id: 'exp-1',
      title: 'Tushlik',
      amount: 45000,
      category: 'oziq_ovqat',
      date: '2026-10-30',
      source: 'bot',
    },
  ],
  currentActivities: [
    {
      id: 'act-1',
      title: 'Badantarbiya',
      localDate: '2026-10-30',
      category: 'sport',
      durationMinutes: 20,
      linkedHabitId: 'habit-1',
      source: 'manual',
      createdAt: '2026-10-30T07:00:00Z',
    },
  ],
  currentSettings: {
    name: 'Foydalanuvchi',
    username: 'user',
    timezone: 'Asia/Tashkent',
    morningTime: '08:00',
    eveningTime: '21:00',
    reminderSound: true,
    aiEnabled: true,
  },
};

// ae1) Invalid history & missing mandatory fields
{
  // a) Bo'sh JSON matni
  const rEmpty = parseAndValidateBackup('', dummyContext);
  assert(!rEmpty.isValid, 'ae1) Bo\'sh matn rad etiladi');

  // b) Buzilgan JSON
  const rCorrupt = parseAndValidateBackup('{not json', dummyContext);
  assert(!rCorrupt.isValid, 'ae1) Sintaktik buzilgan JSON rad etiladi');

  // c) Sarlavhasiz vazifa
  const rNoTitleTask = parseAndValidateBackup(
    JSON.stringify({
      tasks: [{ id: 't-1', date: '2026-10-30', status: 'pending' }],
    }),
    dummyContext
  );
  assert(!rNoTitleTask.isValid, 'ae1) Sarlavhasi yo\'q vazifa rad etiladi');

  // d) Noto'g'ri sanali vazifa
  const rBadDateTask = parseAndValidateBackup(
    JSON.stringify({
      tasks: [{ id: 't-1', title: 'Test', date: '2026-02-31', status: 'pending' }],
    }),
    dummyContext
  );
  assert(!rBadDateTask.isValid, 'ae1) Kalendarda yo\'q sana (2026-02-31) vazifada rad etiladi');

  // e) Yaroqsiz habit frequency
  const rBadFreq = parseAndValidateBackup(
    JSON.stringify({
      habits: [{ id: 'h-1', title: 'Test', frequency: 'invalid_frequency' }],
    }),
    dummyContext
  );
  assert(!rBadFreq.isValid, 'ae1) Noto\'g\'ri habit frequency rad etiladi');

  // f) Yaroqsiz history sanasi
  const rBadHist = parseAndValidateBackup(
    JSON.stringify({
      habits: [
        {
          id: 'h-1',
          title: 'Test',
          frequency: 'daily',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          hasQuantity: false,
          history: { 'not-a-date': { completed: true } },
        },
      ],
    }),
    dummyContext
  );
  assert(!rBadHist.isValid, 'ae1) Tarixdagi noto\'g\'ri sana kaliti rad etiladi');

  // g) Manfiy xarajat
  const rNegExp = parseAndValidateBackup(
    JSON.stringify({
      expenses: [{ id: 'e-1', title: 'Xarajat', amount: -5000, date: '2026-10-30', category: 'oziq_ovqat' }],
    }),
    dummyContext
  );
  assert(!rNegExp.isValid, 'ae1) Manfiy summa bilan xarajat rad etiladi');
}

// ae2) Duplicate habit/task/goal IDs
{
  const rDupTask = parseAndValidateBackup(
    JSON.stringify({
      tasks: [
        { id: 'dup-task', title: 'Vazifa 1', date: '2026-10-30', status: 'pending' },
        { id: 'dup-task', title: 'Vazifa 2', date: '2026-10-30', status: 'pending' },
      ],
    }),
    dummyContext
  );
  assert(!rDupTask.isValid, 'ae2) Takroriy vazifa ID\'si rad etiladi');

  const rDupHabit = parseAndValidateBackup(
    JSON.stringify({
      habits: [
        { id: 'dup-habit', title: 'Odat 1', frequency: 'daily', daysOfWeek: [1], hasQuantity: false },
        { id: 'dup-habit', title: 'Odat 2', frequency: 'daily', daysOfWeek: [1], hasQuantity: false },
      ],
    }),
    dummyContext
  );
  assert(!rDupHabit.isValid, 'ae2) Takroriy odat ID\'si rad etiladi');

  const rDupGoal = parseAndValidateBackup(
    JSON.stringify({
      goals: [
        { id: 'dup-goal', title: 'Maqsad 1', targetValue: 100, currentValue: 10, unit: 'm', status: 'active', deadline: '2026-12-31' },
        { id: 'dup-goal', title: 'Maqsad 2', targetValue: 100, currentValue: 10, unit: 'm', status: 'active', deadline: '2026-12-31' },
      ],
    }),
    dummyContext
  );
  assert(!rDupGoal.isValid, 'ae2) Takroriy maqsad ID\'si rad etiladi');
}

// ae3) Legacy backup without activities breaking habit/task links
{
  // dummyContext'dagi mavjud act-1 habit-1 ga bog'langan.
  // Agar legacy backup'da faoliyatlar kaliti bo'lmasa va habits ichida habit-1 yo'q bo'lsa:
  const rLegacyBroken = parseAndValidateBackup(
    JSON.stringify({
      tasks: [{ id: 'task-legacy', title: 'Vazifa', date: '2026-10-30', status: 'pending' }],
      habits: [{ id: 'other-habit', title: 'Boshqa odat', frequency: 'daily', daysOfWeek: [1], hasQuantity: false }],
      // 'activities' maydoni yo'q
    }),
    dummyContext
  );

  assert(
    !rLegacyBroken.isValid,
    'ae3) Activities kaliti yo\'q eski backup mavjud faoliyatning bog\'lanishini buzsa rad etiladi'
  );
}

// ae4) Export -> import -> export round-trip preserving progress and contributions
{
  const fullBackup = {
    appName: 'Kunlik Yordamchi',
    exportDate: '2026-10-30T12:00:00Z',
    tasks: [
      {
        id: 't-full-1',
        title: 'Hujjatlarni tekshirish',
        category: 'vazifa',
        date: '2026-10-30',
        status: 'completed',
        priority: 'high',
        source: 'miniapp',
      },
    ],
    habits: [
      {
        id: 'h-full-1',
        title: 'Kitob mutolaasi',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        targetQuantity: 30,
        unit: 'bet',
        streak: 7,
        bestStreak: 14,
        linkedGoalId: 'g-full-1',
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 30,
            activityContributions: {
              'act-full-1': { quantity: 30, timestamp: '2026-10-30T10:00:00Z' },
            },
          },
        },
      },
    ],
    goals: [
      {
        id: 'g-full-1',
        title: '10 ta kitob',
        category: 'maqsad',
        deadline: '2026-12-31',
        targetValue: 300,
        currentValue: 150,
        unit: 'bet',
        linkedHabitIds: ['h-full-1'],
        status: 'active',
      },
    ],
    expenses: [
      {
        id: 'e-full-1',
        title: 'Kitob sotib olish',
        amount: 85000,
        category: 'talim',
        date: '2026-10-30',
        source: 'miniapp',
      },
    ],
    activities: [
      {
        id: 'act-full-1',
        title: 'Kitob o\'qish',
        localDate: '2026-10-30',
        category: 'talim',
        durationMinutes: 45,
        quantity: 30,
        unit: 'bet',
        linkedHabitId: 'h-full-1',
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
    settings: {
      name: 'Sherzod',
      username: 'sherzod',
      timezone: 'Asia/Tashkent',
      morningTime: '07:30',
      eveningTime: '22:00',
      reminderSound: true,
      aiEnabled: true,
      monthlyExpenseBudget: 5000000,
    },
  };

  const jsonExport1 = JSON.stringify(fullBackup);
  const importRes = parseAndValidateBackup(jsonExport1, dummyContext);

  assert(importRes.isValid, 'ae4) To\'liq backup muvaffaqiyatli validatsiyadan o\'tadi');
  if (importRes.isValid) {
    const candidate = importRes.candidateData;
    assert(candidate.tasks.length === 1, 'ae4) Vazifalar to\'liq yuklandi');
    assert(candidate.habits[0].history['2026-10-30'].activityContributions?.['act-full-1']?.quantity === 30, 'ae4) activityContributions bus-butun saqlandi');
    assert(candidate.goals[0].currentValue === 150, 'ae4) Maqsad progressi to\'liq saqlandi');
    assert(candidate.activities[0].quantity === 30, 'ae4) Faoliyat saqlandi');

    // Round-trip serialization
    const reExport = {
      appName: 'Kunlik Yordamchi',
      exportDate: fullBackup.exportDate,
      tasks: candidate.tasks,
      habits: candidate.habits,
      goals: candidate.goals,
      expenses: candidate.expenses,
      activities: candidate.activities,
      settings: candidate.settings,
    };
    const jsonExport2 = JSON.stringify(reExport);
    assert(jsonExport1 === jsonExport2, 'ae4) Export -> import -> export round-trip 100% teng bo\'lib saqlanadi');
  }
}

// ae5) Rejected import leaves all state completely untouched
{
  const corruptJson = JSON.stringify({
    tasks: [{ id: 't-1' }], // Missing title, date, etc.
  });

  const res = parseAndValidateBackup(corruptJson, dummyContext);
  assert(!res.isValid, 'ae5) Noto\'g\'ri backup rad etildi');
  assert(dummyContext.currentTasks.length === 1, 'ae5) Kontekstdagi vazifalar o\'zgarmay qoldi');
  assert(dummyContext.currentHabits.length === 1, 'ae5) Kontekstdagi odatlar o\'zgarmay qoldi');
  assert(dummyContext.currentGoals.length === 1, 'ae5) Kontekstdagi maqsadlar o\'zgarmay qoldi');
}

// ============================================================================
// TEST SUITE AF: Ikki yo'nalishli activityContributions va Settings tekshiruvlari
// ============================================================================

// af1) mavjud activity ID, ammo noto'g'ri odat
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-A',
        title: 'Odat A',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'km',
        streak: 1,
        bestStreak: 1,
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 5,
            activityContributions: {
              'act-1': { quantity: 5, timestamp: '2026-10-30T10:00:00Z' },
            },
          },
        },
      },
      {
        id: 'habit-B',
        title: 'Odat B',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'km',
        streak: 0,
        bestStreak: 0,
        history: {},
      },
    ],
    goals: [],
    expenses: [],
    activities: [
      {
        id: 'act-1',
        title: 'Yugurish',
        localDate: '2026-10-30',
        category: 'sport',
        quantity: 5,
        unit: 'km',
        linkedHabitId: 'habit-B', // Faoliyat Habit B ga bog'langan, ammo Habit A tarixiga yozilgan
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af1) mavjud activity ID, ammo noto\'g\'ri odat rad etiladi');
}

// af2) noto'g'ri sana
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-date-test',
        title: 'Yugurish',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'km',
        streak: 1,
        bestStreak: 1,
        history: {
          '2026-10-29': { // Tarix sanasi 2026-10-29
            completed: true,
            quantity: 5,
            activityContributions: {
              'act-date-1': { quantity: 5, timestamp: '2026-10-30T10:00:00Z' },
            },
          },
        },
      },
    ],
    goals: [],
    expenses: [],
    activities: [
      {
        id: 'act-date-1',
        title: 'Yugurish',
        localDate: '2026-10-30', // Faoliyat sanasi 2026-10-30 (tarix sanasiga mos emas)
        category: 'sport',
        quantity: 5,
        unit: 'km',
        linkedHabitId: 'habit-date-test',
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af2) noto\'g\'ri sana (activity.localDate !== history date) rad etiladi');
}

// af3) noto'g'ri hissa miqdori
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-qty-test',
        title: 'Kitob',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'bet',
        streak: 1,
        bestStreak: 1,
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 20,
            activityContributions: {
              'act-qty-1': { quantity: 20, timestamp: '2026-10-30T10:00:00Z' }, // Hissa miqdori 20
            },
          },
        },
      },
    ],
    goals: [],
    expenses: [],
    activities: [
      {
        id: 'act-qty-1',
        title: 'Kitob o\'qish',
        localDate: '2026-10-30',
        category: 'talim',
        quantity: 30, // Faoliyat miqdori 30 (mos emas!)
        unit: 'bet',
        linkedHabitId: 'habit-qty-test',
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af3) noto\'g\'ri hissa miqdori (contrib.quantity !== act.quantity) rad etiladi');
}

// af4) activity bor, hissa yo'q (reverse check)
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-rev-test',
        title: 'Suzish',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: false,
        streak: 0,
        bestStreak: 0,
        history: {}, // Odat tarixida faoliyat hissasi yo'q!
      },
    ],
    goals: [],
    expenses: [],
    activities: [
      {
        id: 'act-rev-1',
        title: 'Suzish mashqi',
        localDate: '2026-10-30',
        category: 'sport',
        linkedHabitId: 'habit-rev-test',
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af4) activity bor, ammo tegishli hissa yo\'q holati rad etiladi');
}

// af5) hissa bor, activity yo'q
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-ghost-test',
        title: 'Yugurish',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'km',
        streak: 1,
        bestStreak: 1,
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 5,
            activityContributions: {
              'act-ghost-999': { quantity: 5, timestamp: '2026-10-30T10:00:00Z' }, // activities ro'yxatida yo'q!
            },
          },
        },
      },
    ],
    goals: [],
    expenses: [],
    activities: [], // Bo'sh faoliyatlar
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af5) hissa bor, ammo activity yo\'q (arvoh hissa) rad etiladi');
}

// af6) hisoblangan jami quantity bilan history.quantity farqi
{
  const backup = {
    tasks: [],
    habits: [
      {
        id: 'habit-sync-test',
        title: 'Kitob',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        unit: 'bet',
        streak: 1,
        bestStreak: 1,
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 50, // Buzilgan qiymat: hissa 20, manual 0 bo'lsa-da 50 yozilgan!
            activityContributions: {
              'act-sync-1': { quantity: 20, timestamp: '2026-10-30T10:00:00Z' },
            },
          },
        },
      },
    ],
    goals: [],
    expenses: [],
    activities: [
      {
        id: 'act-sync-1',
        title: 'Kitob',
        localDate: '2026-10-30',
        category: 'talim',
        quantity: 20,
        unit: 'bet',
        linkedHabitId: 'habit-sync-test',
        source: 'manual',
        createdAt: '2026-10-30T10:00:00Z',
      },
    ],
  };

  const res = parseAndValidateBackup(JSON.stringify(backup), dummyContext);
  assert(!res.isValid, 'af6) hisoblangan jami quantity bilan history.quantity farqi rad etiladi');
}

// af7) timezone: 123, aiEnabled: "false", morningTime: "25:90"
{
  // a) timezone son bo'lsa
  const rTzNum = parseAndValidateBackup(
    JSON.stringify({
      settings: {
        name: 'Ali',
        username: 'ali',
        timezone: 123,
        morningTime: '08:00',
        eveningTime: '21:00',
        reminderSound: true,
        aiEnabled: true,
      },
    }),
    dummyContext
  );
  assert(!rTzNum.isValid, 'af7a) timezone: 123 rad etiladi');

  // b) aiEnabled string bo'lsa ("false")
  const rAiStr = parseAndValidateBackup(
    JSON.stringify({
      settings: {
        name: 'Ali',
        username: 'ali',
        timezone: 'Asia/Tashkent',
        morningTime: '08:00',
        eveningTime: '21:00',
        reminderSound: true,
        aiEnabled: 'false', // string emas, boolean bo'lishi shart
      },
    }),
    dummyContext
  );
  assert(!rAiStr.isValid, 'af7b) aiEnabled: "false" rad etiladi');

  // c) morningTime noto'g'ri bo'lsa ("25:90")
  const rTimeBad = parseAndValidateBackup(
    JSON.stringify({
      settings: {
        name: 'Ali',
        username: 'ali',
        timezone: 'Asia/Tashkent',
        morningTime: '25:90',
        eveningTime: '21:00',
        reminderSound: true,
        aiEnabled: true,
      },
    }),
    dummyContext
  );
  assert(!rTimeBad.isValid, 'af7c) morningTime: "25:90" rad etiladi');

  // d) Noma'lum maydonlar filtrlanadi, rogue parametrlar qolmaydi
  const rSanitize = parseAndValidateBackup(
    JSON.stringify({
      settings: {
        name: 'Ali',
        username: 'ali',
        timezone: 'Asia/Tashkent',
        morningTime: '08:00',
        eveningTime: '21:00',
        reminderSound: true,
        aiEnabled: true,
        monthlyExpenseBudget: 1000000,
        maliciousField: 'hack_attempt',
      },
    }),
    dummyContext
  );
  assert(rSanitize.isValid, 'af7d) To\'g\'ri settings validatsiyadan o\'tadi');
  if (rSanitize.isValid) {
    assert(
      (rSanitize.candidateData.settings as any).maliciousField === undefined,
      'af7d) Noma\'lum maydonlar (maliciousField) sanitizatsiya qilinib filtrlanadi'
    );
  }
}

// af8) haqiqiy export/import round-trip
{
  const realBackup = {
    appName: 'Kunlik Yordamchi',
    exportDate: '2026-10-30T18:00:00Z',
    tasks: [
      {
        id: 't-real-1',
        title: 'Mijoz bilan uchrashuv',
        category: 'uchrashuv',
        date: '2026-10-30',
        time: '14:00',
        status: 'pending',
        priority: 'high',
        source: 'bot',
      },
    ],
    habits: [
      {
        id: 'h-real-1',
        title: 'Yugurish',
        category: 'odat',
        frequency: 'daily',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        hasQuantity: true,
        targetQuantity: 5,
        unit: 'km',
        streak: 4,
        bestStreak: 10,
        linkedGoalId: 'g-real-1',
        history: {
          '2026-10-30': {
            completed: true,
            quantity: 5,
            manualCompleted: false,
            manualQuantity: 0,
            activityContributions: {
              'act-real-1': { quantity: 5, timestamp: '2026-10-30T07:00:00Z' },
            },
          },
        },
      },
    ],
    goals: [
      {
        id: 'g-real-1',
        title: 'Yarim marafon',
        category: 'maqsad',
        deadline: '2026-12-31',
        targetValue: 21,
        currentValue: 5,
        unit: 'km',
        linkedHabitIds: ['h-real-1'],
        status: 'active',
      },
    ],
    expenses: [
      {
        id: 'e-real-1',
        title: 'Sport krossovkasi',
        amount: 450000,
        currency: 'UZS',
        category: 'sport',
        date: '2026-10-30',
        source: 'miniapp',
      },
    ],
    activities: [
      {
        id: 'act-real-1',
        title: 'Tonggi yugurish',
        localDate: '2026-10-30',
        time: '07:00',
        category: 'sport',
        durationMinutes: 30,
        quantity: 5,
        unit: 'km',
        linkedHabitId: 'h-real-1',
        source: 'manual',
        createdAt: '2026-10-30T07:00:00Z',
      },
    ],
    settings: {
      name: 'Aziz',
      username: 'azizbek',
      timezone: 'Asia/Tashkent (UZT)',
      morningTime: '06:30',
      eveningTime: '22:30',
      reminderSound: true,
      aiEnabled: true,
      monthlyExpenseBudget: 3000000,
    },
  };

  const json1 = JSON.stringify(realBackup);
  const res = parseAndValidateBackup(json1, dummyContext);

  assert(res.isValid, 'af8) Haqiqiy export validatsiyadan muvaffaqiyatli o\'tadi');
  if (res.isValid) {
    const candidate = res.candidateData;
    const reExport = {
      appName: 'Kunlik Yordamchi',
      exportDate: realBackup.exportDate,
      tasks: candidate.tasks,
      habits: candidate.habits,
      goals: candidate.goals,
      expenses: candidate.expenses,
      activities: candidate.activities,
      settings: candidate.settings,
    };
    const json2 = JSON.stringify(reExport);
    assert(json1 === json2, 'af8) Haqiqiy export/import round-trip to\'liq tenglikni saqlaydi');
  }
}

console.log(`\n========================================`);
console.log(`JAMI NATIJALAR: ${passed} O'TDI, ${failed} XATO`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
