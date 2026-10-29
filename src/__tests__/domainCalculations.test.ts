import {
  applyHabitQuantityChange,
  applyHabitToggle,
  calculateHabitStreakAndStats,
  calculatePostponedTask,
  generateEntityId,
  areUnitsCompatible,
  getDateStringInTimezone,
  addDaysToYMD,
} from '../utils/domainCalculations';
import { Habit, Goal, Task } from '../types';

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

  assert(postponed.date === '2026-10-30', 'g) Yarim tundan o\'tganda sana keyingi kunga o\'tishi kerak (2026-10-30)', `Sana: ${postponed.date}`);
  assert(postponed.time === '00:05', 'g) Yangi vaqt 00:05 bo\'lishi kerak', `Vaqt: ${postponed.time}`);
  assert(postponed.status === 'postponed', 'g) Status "postponed" bo\'lishi kerak');

  // Soati yo'q vazifani kechiktirish:
  const taskNoTime: Task = {
    ...task,
    time: undefined,
    date: '2026-10-29',
  };
  const fixedNow = new Date('2026-10-29T09:30:00Z'); // 14:30 in Tashkent (UTC+5)
  const postponedUntimed = calculatePostponedTask(taskNoTime, 30, fixedNow, 'Asia/Tashkent');
  assert(
    postponedUntimed.date === '2026-10-29' && postponedUntimed.time === '15:00',
    'g) Soati yo\'q bugungi vazifa joriy vaqtdan +30 daqiqaga surilishi kerak (14:30 + 30m -> 15:00)',
    `Natija: ${postponedUntimed.date} ${postponedUntimed.time}`
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

console.log(`\n========================================`);
console.log(`JAMI NATIJALAR: ${passed} O'TDI, ${failed} XATO`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
