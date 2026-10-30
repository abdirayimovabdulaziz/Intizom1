import { Habit, Goal, Task, HabitFrequency } from '../types';

/**
 * Normalizes timezone string to a valid IANA timezone identifier
 */
export function getIanaTimezone(rawTimezone?: string): string {
  if (!rawTimezone) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent';
    } catch {
      return 'Asia/Tashkent';
    }
  }
  const clean = rawTimezone.split(' ')[0].trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: clean });
    return clean;
  } catch {
    return 'Asia/Tashkent';
  }
}

/**
 * Returns date formatted as YYYY-MM-DD in the given timezone (default: Asia/Tashkent)
 * Uses Intl.formatToParts to guarantee exact YYYY-MM-DD representation across all locales/devices
 */
export function getDateStringInTimezone(date: Date = new Date(), timezone: string = 'Asia/Tashkent'): string {
  const iana = getIanaTimezone(timezone);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: iana,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    let y = '', m = '', d = '';
    for (const p of parts) {
      if (p.type === 'year') y = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'day') d = p.value;
    }
    if (y && m && d) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns ISO day of week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
 */
export function getDayOfWeekFromYMD(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = dt.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Returns current ISO day of week (1=Mon..7=Sun) in the user's timezone
 */
export function getDayOfWeekInTimezone(date: Date = new Date(), timezone: string = 'Asia/Tashkent'): number {
  const ymd = getDateStringInTimezone(date, timezone);
  return getDayOfWeekFromYMD(ymd);
}

/**
 * Adds offset days to a YYYY-MM-DD date string using pure UTC arithmetic
 */
export function addDaysToYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates whether a string is a strict YYYY-MM-DD format and a real calendar date.
 * Rejects "abc", "2026-02-31", "2026-13-01", etc. Handles leap years correctly.
 */
export function isValidYMD(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Generates an entity ID using crypto.randomUUID() when available, with a fallback
 */
export function generateEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Checks if habit unit and goal unit are compatible
 */
export function areUnitsCompatible(habitUnit?: string, goalUnit?: string): boolean {
  const hUnit = (habitUnit || '').trim().toLowerCase();
  const gUnit = (goalUnit || '').trim().toLowerCase();
  if (!hUnit && !gUnit) return true;
  return hUnit === gUnit;
}

/**
 * Validates and sanitizes scheduled days array to prevent infinite loops.
 * Rejects non-integers (e.g. 1.5), out-of-range numbers, NaN and Infinity.
 */
export function validateDaysOfWeek(daysOfWeek?: number[]): number[] {
  if (!Array.isArray(daysOfWeek)) return [1, 2, 3, 4, 5, 6, 7];
  const valid = daysOfWeek
    .map(Number)
    .filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
  return valid.length > 0 ? Array.from(new Set(valid)).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];
}

export interface HabitStreakStats {
  streak: number;
  bestStreak: number;
  weeklyCompletions?: number;
}

/**
 * Pure function to calculate habit streak and best streak based on history and frequency schedule.
 * - daily: consecutive completed days. If today is incomplete, streak continues if yesterday was completed.
 * - specific_days: rest days (non-scheduled days) DO NOT break the streak.
 * - weekly_target: weekly progress is calculated separately (completed days in week vs target). Streak counts consecutive weeks target was met.
 * - Future dates (> referenceDateStr) are never counted into current streaks or current week completions.
 */
export function calculateHabitStreakAndStats(
  history: Record<string, { completed: boolean; quantity?: number }>,
  frequency: HabitFrequency,
  daysOfWeek: number[] = [1, 2, 3, 4, 5, 6, 7],
  targetDaysPerWeek: number = 3,
  referenceDateStr: string = getDateStringInTimezone(),
  existingBestStreak: number = 0
): HabitStreakStats {
  const sanitizedDays = validateDaysOfWeek(daysOfWeek);
  const validTargetDays = Math.min(7, Math.max(1, Math.round(targetDaysPerWeek || 3)));

  if (frequency === 'weekly_target') {
    return calculateWeeklyTargetStats(history, validTargetDays, referenceDateStr, existingBestStreak);
  }

  if (frequency === 'specific_days') {
    return calculateSpecificDaysStreak(history, sanitizedDays, referenceDateStr, existingBestStreak);
  }

  // Frequency === 'daily'
  return calculateDailyStreak(history, referenceDateStr, existingBestStreak);
}

function calculateDailyStreak(
  history: Record<string, { completed: boolean; quantity?: number }>,
  referenceDateStr: string,
  existingBestStreak: number
): HabitStreakStats {
  const isTodayCompleted = !!history[referenceDateStr]?.completed;
  const yesterdayStr = addDaysToYMD(referenceDateStr, -1);
  const isYesterdayCompleted = !!history[yesterdayStr]?.completed;

  let currentStreak = 0;
  let startCheckDate: string | null = null;

  if (isTodayCompleted) {
    currentStreak = 1;
    startCheckDate = yesterdayStr;
  } else if (isYesterdayCompleted) {
    currentStreak = 1;
    startCheckDate = addDaysToYMD(yesterdayStr, -1);
  }

  if (startCheckDate) {
    let checkDate = startCheckDate;
    while (history[checkDate]?.completed) {
      currentStreak += 1;
      checkDate = addDaysToYMD(checkDate, -1);
    }
  }

  // Calculate pure best streak across all history up to referenceDateStr
  const completedDates = Object.keys(history)
    .filter(d => d <= referenceDateStr && history[d]?.completed)
    .sort();

  let maxStreak = 0;
  let running = 0;
  let prevDate: string | null = null;

  for (const d of completedDates) {
    if (!prevDate) {
      running = 1;
    } else {
      const expectedNext = addDaysToYMD(prevDate, 1);
      if (d === expectedNext) {
        running += 1;
      } else {
        running = 1;
      }
    }
    prevDate = d;
    if (running > maxStreak) {
      maxStreak = running;
    }
  }

  const bestStreak = Math.max(existingBestStreak || 0, maxStreak, currentStreak);

  return { streak: currentStreak, bestStreak };
}

function calculateSpecificDaysStreak(
  history: Record<string, { completed: boolean; quantity?: number }>,
  scheduledDays: number[],
  referenceDateStr: string,
  existingBestStreak: number
): HabitStreakStats {
  const activeScheduledDays = validateDaysOfWeek(scheduledDays);

  const getPreviousScheduledDate = (fromDate: string): string => {
    let curr = addDaysToYMD(fromDate, -1);
    let attempts = 0;
    while (!activeScheduledDays.includes(getDayOfWeekFromYMD(curr)) && attempts < 8) {
      curr = addDaysToYMD(curr, -1);
      attempts++;
    }
    return curr;
  };

  const isScheduledDay = (d: string) => activeScheduledDays.includes(getDayOfWeekFromYMD(d));

  let currentStreak = 0;
  let lastCompletedScheduledDate: string | null = null;

  const todayIsScheduled = isScheduledDay(referenceDateStr);
  const todayCompleted = todayIsScheduled && !!history[referenceDateStr]?.completed;

  if (todayCompleted) {
    currentStreak = 1;
    lastCompletedScheduledDate = referenceDateStr;
  } else {
    // If today is not completed (or today is a rest day), check the most recent scheduled day before today
    const prevScheduled = getPreviousScheduledDate(referenceDateStr);
    if (history[prevScheduled]?.completed) {
      currentStreak = 1;
      lastCompletedScheduledDate = prevScheduled;
    }
  }

  if (lastCompletedScheduledDate) {
    let checkDate = getPreviousScheduledDate(lastCompletedScheduledDate);
    while (history[checkDate]?.completed) {
      currentStreak += 1;
      checkDate = getPreviousScheduledDate(checkDate);
    }
  }

  // Calculate historical max streak across all scheduled days in history up to referenceDateStr
  const completedScheduledDates = Object.keys(history)
    .filter(d => d <= referenceDateStr && isScheduledDay(d) && history[d]?.completed)
    .sort();

  let maxHistorical = 0;
  let running = 0;
  let prevScheduledDate: string | null = null;

  for (const d of completedScheduledDates) {
    if (!prevScheduledDate) {
      running = 1;
    } else {
      const expectedPrev = getPreviousScheduledDate(d);
      if (prevScheduledDate === expectedPrev) {
        running += 1;
      } else {
        running = 1;
      }
    }
    prevScheduledDate = d;
    if (running > maxHistorical) {
      maxHistorical = running;
    }
  }

  const bestStreak = Math.max(existingBestStreak || 0, maxHistorical, currentStreak);
  return { streak: currentStreak, bestStreak };
}

function calculateWeeklyTargetStats(
  history: Record<string, { completed: boolean; quantity?: number }>,
  targetDaysPerWeek: number,
  referenceDateStr: string,
  existingBestStreak: number
): HabitStreakStats {
  const validTarget = Math.min(7, Math.max(1, Math.round(targetDaysPerWeek || 3)));

  // Find Monday of the current week containing referenceDateStr
  const currentDayOfWeek = getDayOfWeekFromYMD(referenceDateStr); // 1..7
  const currentMonday = addDaysToYMD(referenceDateStr, -(currentDayOfWeek - 1));

  // Count completions in current week (Monday to Sunday) up to referenceDateStr (exclude future dates)
  let currentWeekCompletions = 0;
  for (let i = 0; i < 7; i++) {
    const dayStr = addDaysToYMD(currentMonday, i);
    if (dayStr <= referenceDateStr && history[dayStr]?.completed) {
      currentWeekCompletions += 1;
    }
  }

  // Group all historical completed dates by week Monday
  const weekCompletionsMap: Record<string, Set<string>> = {};
  for (const [d, record] of Object.entries(history)) {
    if (record?.completed && d <= referenceDateStr) {
      const dow = getDayOfWeekFromYMD(d);
      const mon = addDaysToYMD(d, -(dow - 1));
      if (!weekCompletionsMap[mon]) {
        weekCompletionsMap[mon] = new Set();
      }
      weekCompletionsMap[mon].add(d);
    }
  }

  // Calculate current weekly streak backwards
  let weeklyStreak = 0;
  let checkMonday: string | null = null;

  const currentWeekMet = currentWeekCompletions >= validTarget;
  if (currentWeekMet) {
    weeklyStreak = 1;
    checkMonday = addDaysToYMD(currentMonday, -7);
  } else {
    // Current week not yet met; check if previous week was met
    const prevMonday = addDaysToYMD(currentMonday, -7);
    const prevCount = weekCompletionsMap[prevMonday]?.size || 0;
    if (prevCount >= validTarget) {
      weeklyStreak = 1;
      checkMonday = addDaysToYMD(prevMonday, -7);
    }
  }

  while (checkMonday) {
    const count = weekCompletionsMap[checkMonday]?.size || 0;
    if (count >= validTarget) {
      weeklyStreak += 1;
      checkMonday = addDaysToYMD(checkMonday, -7);
    } else {
      break;
    }
  }

  // Calculate all-time max contiguous weekly streak across history
  const allWeekMondays = Object.keys(weekCompletionsMap).sort();
  let maxHistoricalWeeks = 0;
  let runningWeeks = 0;
  let prevMetMonday: string | null = null;

  for (const mon of allWeekMondays) {
    const count = weekCompletionsMap[mon].size;
    if (count >= validTarget) {
      if (!prevMetMonday) {
        runningWeeks = 1;
      } else {
        const expectedNextMon = addDaysToYMD(prevMetMonday, 7);
        if (mon === expectedNextMon) {
          runningWeeks += 1;
        } else {
          runningWeeks = 1;
        }
      }
      prevMetMonday = mon;
      if (runningWeeks > maxHistoricalWeeks) {
        maxHistoricalWeeks = runningWeeks;
      }
    }
  }

  const bestStreak = Math.max(existingBestStreak || 0, maxHistoricalWeeks, weeklyStreak);
  return {
    streak: weeklyStreak,
    bestStreak,
    weeklyCompletions: currentWeekCompletions,
  };
}

/**
 * Calculates metrics for goal internal habits.
 * Since targetFrequency is free-text and not a structured schedule,
 * we do not guess an unreliable schedule-dependent streak.
 * We calculate totalCompletions separately without overwriting existing streak/bestStreak.
 */
export function calculateInternalHabitStats(
  history: Record<string, { completed: boolean; timestamp?: string }> = {},
  referenceDateStr: string = getDateStringInTimezone(),
  existingStreak: number = 0,
  existingBestStreak: number = 0
): { streak: number; bestStreak: number; totalCompletions: number } {
  const completedDates = Object.keys(history).filter(
    d => d <= referenceDateStr && history[d]?.completed
  );
  const totalCompletions = completedDates.length;

  return {
    streak: existingStreak,
    bestStreak: existingBestStreak,
    totalCompletions,
  };
}

export const calculateInternalHabitStreak = calculateInternalHabitStats;

/**
 * Calculates updated habit and linked goal state atomically
 */
export function applyHabitQuantityChange(
  habit: Habit,
  linkedGoal: Goal | undefined,
  deltaAmount: number,
  dateStr: string,
  timestamp: string
): { updatedHabit: Habit; updatedGoal?: Goal; actualDelta: number } {
  const currentRecord = habit.history[dateStr] || { completed: false, quantity: 0 };
  const prevQty = currentRecord.quantity || 0;
  const newQty = Math.max(0, prevQty + deltaAmount);
  const actualDelta = newQty - prevQty;

  const isCompleted = habit.targetQuantity ? newQty >= habit.targetQuantity : newQty > 0;

  const updatedHistory = {
    ...habit.history,
    [dateStr]: {
      completed: isCompleted,
      quantity: newQty,
      timestamp,
    },
  };

  const streakStats = calculateHabitStreakAndStats(
    updatedHistory,
    habit.frequency,
    habit.daysOfWeek,
    habit.targetDaysPerWeek,
    dateStr,
    habit.bestStreak
  );

  const updatedHabit: Habit = {
    ...habit,
    history: updatedHistory,
    currentQuantityToday: newQty,
    streak: streakStats.streak,
    bestStreak: streakStats.bestStreak,
    weeklyCompletions: streakStats.weeklyCompletions,
  };

  let updatedGoal: Goal | undefined;

  if (linkedGoal && areUnitsCompatible(habit.unit, linkedGoal.unit) && actualDelta !== 0) {
    const isDecrease = linkedGoal.goalType === 'decrease';
    const nextVal = isDecrease
      ? Math.max(0, linkedGoal.currentValue - actualDelta)
      : Math.max(0, linkedGoal.currentValue + actualDelta);

    const isAchieved = isDecrease ? nextVal <= linkedGoal.targetValue : nextVal >= linkedGoal.targetValue;

    updatedGoal = {
      ...linkedGoal,
      currentValue: nextVal,
      status: isAchieved ? 'achieved' : 'active',
    };
  }

  return { updatedHabit, updatedGoal, actualDelta };
}

/**
 * Applies completion status (true or false) to a habit idempotently.
 * If targetCompleted matches current status, does not invert or duplicate.
 */
export function applyHabitCompletionStatus(
  habit: Habit,
  linkedGoal: Goal | undefined,
  dateStr: string,
  timestamp: string,
  targetCompleted: boolean = true
): { updatedHabit: Habit; updatedGoal?: Goal; wasAlreadyCompleted: boolean; actualDelta: number } {
  const currentRecord = habit.history[dateStr] || { completed: false, quantity: 0 };
  const wasAlreadyCompleted = !!currentRecord.completed;

  if (wasAlreadyCompleted === targetCompleted) {
    return {
      updatedHabit: habit,
      updatedGoal: linkedGoal,
      wasAlreadyCompleted,
      actualDelta: 0,
    };
  }

  const targetQty = habit.targetQuantity || 1;
  const newQty = targetCompleted ? targetQty : 0;
  const prevQty = currentRecord.quantity || 0;
  const actualDelta = newQty - prevQty;

  const updatedHistory = {
    ...habit.history,
    [dateStr]: {
      completed: targetCompleted,
      quantity: newQty,
      timestamp,
    },
  };

  const streakStats = calculateHabitStreakAndStats(
    updatedHistory,
    habit.frequency,
    habit.daysOfWeek,
    habit.targetDaysPerWeek,
    dateStr,
    habit.bestStreak
  );

  const updatedHabit: Habit = {
    ...habit,
    history: updatedHistory,
    currentQuantityToday: newQty,
    streak: streakStats.streak,
    bestStreak: streakStats.bestStreak,
    weeklyCompletions: streakStats.weeklyCompletions,
  };

  let updatedGoal: Goal | undefined;

  if (linkedGoal && areUnitsCompatible(habit.unit, linkedGoal.unit) && actualDelta !== 0) {
    const isDecrease = linkedGoal.goalType === 'decrease';
    const nextVal = isDecrease
      ? Math.max(0, linkedGoal.currentValue - actualDelta)
      : Math.max(0, linkedGoal.currentValue + actualDelta);

    const isAchieved = isDecrease ? nextVal <= linkedGoal.targetValue : nextVal >= linkedGoal.targetValue;

    updatedGoal = {
      ...linkedGoal,
      currentValue: nextVal,
      status: isAchieved ? 'achieved' : 'active',
    };
  }

  return { updatedHabit, updatedGoal, wasAlreadyCompleted, actualDelta };
}

/**
 * Calculates updated habit and linked goal state for toggle action atomically
 */
export function applyHabitToggle(
  habit: Habit,
  linkedGoal: Goal | undefined,
  dateStr: string,
  timestamp: string
): { updatedHabit: Habit; updatedGoal?: Goal; willBeCompleted: boolean; actualDelta: number } {
  const currentRecord = habit.history[dateStr] || { completed: false, quantity: 0 };
  const willBeCompleted = !currentRecord.completed;
  const { updatedHabit, updatedGoal, actualDelta } = applyHabitCompletionStatus(
    habit,
    linkedGoal,
    dateStr,
    timestamp,
    willBeCompleted
  );
  return { updatedHabit, updatedGoal, willBeCompleted, actualDelta };
}

export interface HabitIntakeRequest {
  title: string;
  targetHabitId?: string;
  markDoneToday?: boolean;
}

export type HabitIntakeDecision =
  | {
      action: 'mark_completed';
      habit: Habit;
      alreadyCompleted: boolean;
      shouldMarkCompletion: true;
      feedbackText: string;
    }
  | {
      action: 'already_exists';
      habit: Habit;
      shouldMarkCompletion: false;
      feedbackText: string;
    }
  | {
      action: 'disambiguation_needed';
      candidates: Habit[];
      shouldMarkCompletion: false;
      feedbackText: string;
    }
  | {
      action: 'create_new';
      shouldMarkCompletion: boolean;
      feedbackText: string;
    };

/**
 * Production decision function for habit / supplement intakes:
 *
 * Rules:
 * 1. Archived habits (isArchived === true) are never automatically selected.
 * 2. If targetHabitId is provided, authoritative match on active habits:
 *    - If markDoneToday: 'mark_completed' (idempotent, checks alreadyCompleted)
 *    - If not markDoneToday: 'already_exists'
 * 3. If no targetHabitId:
 *    - Check exact active matches (case/whitespace/apostrophe normalized).
 *    - If > 1 exact matches: 'disambiguation_needed' (never arbitrarily pick one)
 *    - If 1 exact match:
 *        * If markDoneToday: 'mark_completed'
 *        * If not markDoneToday: 'already_exists' (do not create duplicate, do not mark completed)
 *    - If 0 exact matches:
 *        * Check partial / token matches on active habits.
 *        * If > 1 candidates: 'disambiguation_needed' (never arbitrarily pick one)
 *        * If 1 candidate:
 *            - If markDoneToday: 'mark_completed'
 *            - If not markDoneToday: 'already_exists'
 *        * If 0 candidates:
 *            - 'create_new' (with shouldMarkCompletion = !!markDoneToday)
 */
export function calculateHabitIntakeDecision(
  allHabits: Habit[],
  request: HabitIntakeRequest,
  dateStr: string
): HabitIntakeDecision {
  const activeHabits = allHabits.filter(h => !h.isArchived);

  // 1. Authoritative habit ID
  if (request.targetHabitId) {
    const target = activeHabits.find(h => h.id === request.targetHabitId);
    if (target) {
      if (request.markDoneToday) {
        const alreadyCompleted = !!target.history[dateStr]?.completed;
        return {
          action: 'mark_completed',
          habit: target,
          alreadyCompleted,
          shouldMarkCompletion: true,
          feedbackText: alreadyCompleted
            ? `✅ "${target.title}" bugun allaqachon bajarilgan!`
            : `✅ Qabul qilindi! "${target.title}" bugungi ro'yxatda bajarilgan deb belgilandi!`,
        };
      } else {
        return {
          action: 'already_exists',
          habit: target,
          shouldMarkCompletion: false,
          feedbackText: `ℹ️ "${target.title}" odati allaqachon ro'yxatingizda mavjud.`,
        };
      }
    }
  }

  const clean = (s: string) =>
    s.toLowerCase()
      .replace(/['`‘ʻ’ʼ]/g, "'")
      .replace(/[\s\-_]+/g, ' ')
      .trim();

  const reqNorm = clean(request.title || '');

  // 2. Exact match check
  const exactMatches = activeHabits.filter(h => clean(h.title) === reqNorm);
  if (exactMatches.length === 1) {
    const matched = exactMatches[0];
    if (request.markDoneToday) {
      const alreadyCompleted = !!matched.history[dateStr]?.completed;
      return {
        action: 'mark_completed',
        habit: matched,
        alreadyCompleted,
        shouldMarkCompletion: true,
        feedbackText: alreadyCompleted
          ? `✅ "${matched.title}" bugun allaqachon bajarilgan!`
          : `✅ Qabul qilindi! "${matched.title}" bugungi ro'yxatda bajarilgan deb belgilandi!`,
      };
    } else {
      return {
        action: 'already_exists',
        habit: matched,
        shouldMarkCompletion: false,
        feedbackText: `ℹ️ "${matched.title}" odati allaqachon ro'yxatingizda mavjud.`,
      };
    }
  }

  if (exactMatches.length > 1) {
    return {
      action: 'disambiguation_needed',
      candidates: exactMatches,
      shouldMarkCompletion: false,
      feedbackText: `🔍 "${request.title}" bo'yicha bir nechta mos odat topildi. Iltimos, aynan qaysi birini nazarda tutganingizni tanlang:`,
    };
  }

  // 3. Partial / token match check
  const partialMatches = activeHabits.filter(h => {
    const hNorm = clean(h.title);
    if (hNorm.includes(reqNorm) || reqNorm.includes(hNorm)) return true;
    const hTokens = hNorm.split(' ').filter(t => t.length > 3);
    const reqTokens = reqNorm.split(' ').filter(t => t.length > 3);
    return reqTokens.some(t => hTokens.includes(t));
  });

  if (partialMatches.length > 1) {
    return {
      action: 'disambiguation_needed',
      candidates: partialMatches,
      shouldMarkCompletion: false,
      feedbackText: `🔍 "${request.title}" bo'yicha bir nechta mos odat topildi. Iltimos, aynan qaysi birini nazarda tutganingizni tanlang:`,
    };
  }

  if (partialMatches.length === 1) {
    const matched = partialMatches[0];
    if (request.markDoneToday) {
      const alreadyCompleted = !!matched.history[dateStr]?.completed;
      return {
        action: 'mark_completed',
        habit: matched,
        alreadyCompleted,
        shouldMarkCompletion: true,
        feedbackText: alreadyCompleted
          ? `✅ "${matched.title}" bugun allaqachon bajarilgan!`
          : `✅ Qabul qilindi! "${matched.title}" bugungi ro'yxatda bajarilgan deb belgilandi!`,
      };
    } else {
      return {
        action: 'already_exists',
        habit: matched,
        shouldMarkCompletion: false,
        feedbackText: `ℹ️ "${matched.title}" odati allaqachon ro'yxatingizda mavjud.`,
      };
    }
  }

  // 4. No matches: create new
  return {
    action: 'create_new',
    shouldMarkCompletion: !!request.markDoneToday,
    feedbackText: request.markDoneToday
      ? `🎉 Yangi qabul saqlandi va bugun bajarilgan deb belgilandi: "${request.title}"!`
      : `🎉 Yangi qabul saqlandi: "${request.title}"! Har kuni belgilashingiz mumkin.`,
  };
}

/**
 * Calculates task postponing with midnight rollover and sensible untimed default
 *
 * Rules:
 * - If minutesOrDate is a date string (e.g. YYYY-MM-DD): update date, keep time, status = 'postponed'
 * - If minutesOrDate is a number (minutes):
 *     1. Validates minutes is a finite number.
 *     2. Start from task.date (default to today in timezone if missing).
 *     3. Time baseline:
 *        - If task.time exists: strict range validation for hours (0..23) and minutes (0..59)
 *        - If task.time does NOT exist:
 *            * If task.date === today: baseline is current time in target timezone (handling 00:00 midnight correctly)
 *            * If task.date !== today: baseline is 09:00
 *     4. Add minutes. If crosses midnight (e.g. 23:50 + 15m -> 00:05), date increments to next day.
 */
export function calculatePostponedTask(
  task: Task,
  minutesOrDate: number | string,
  now: Date = new Date(),
  timezone: string = 'Asia/Tashkent'
): Partial<Task> | null {
  if (typeof minutesOrDate === 'string') {
    const trimmed = minutesOrDate.trim();
    if (!isValidYMD(trimmed)) {
      return null;
    }
    return {
      date: trimmed,
      status: 'postponed',
      postponedUntil: trimmed,
    };
  }

  if (typeof minutesOrDate !== 'number' || !Number.isFinite(minutesOrDate) || isNaN(minutesOrDate)) {
    return null;
  }

  const minutesToAdd = Math.round(minutesOrDate);
  const todayStr = getDateStringInTimezone(now, timezone);
  const baseDate = task.date || todayStr;

  let baseHours = 9;
  let baseMinutes = 0;

  if (task.time && typeof task.time === 'string' && task.time.includes(':')) {
    const parts = task.time.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    baseHours = Number.isFinite(h) && h >= 0 && h < 24 ? h : 9;
    baseMinutes = Number.isFinite(m) && m >= 0 && m < 60 ? m : 0;
  } else if (baseDate === todayStr) {
    // Current time in specified timezone using formatToParts
    const iana = getIanaTimezone(timezone);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: iana,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    let hVal: number | null = null;
    let mVal: number | null = null;
    for (const p of parts) {
      if (p.type === 'hour') hVal = Number(p.value);
      if (p.type === 'minute') mVal = Number(p.value);
    }
    // Strict finite range check so that 00:00 midnight is preserved and not replaced by fallback
    baseHours = Number.isFinite(hVal) && hVal !== null && hVal >= 0 && hVal < 24 ? hVal : now.getHours();
    baseMinutes = Number.isFinite(mVal) && mVal !== null && mVal >= 0 && mVal < 60 ? mVal : now.getMinutes();
  }

  const [year, month, day] = baseDate.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day, baseHours, baseMinutes + minutesToAdd, 0, 0));

  const newYear = dt.getUTCFullYear();
  const newMonth = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const newDay = String(dt.getUTCDate()).padStart(2, '0');
  const newDate = `${newYear}-${newMonth}-${newDay}`;

  const newHours = String(dt.getUTCHours()).padStart(2, '0');
  const newMins = String(dt.getUTCMinutes()).padStart(2, '0');
  const newTime = `${newHours}:${newMins}`;

  return {
    date: newDate,
    time: newTime,
    status: 'postponed',
    postponedUntil: `${newDate} ${newTime}`,
  };
}

/**
 * Returns formatted HH:MM in the specified timezone
 */
export function getTimeStringInTimezone(date: Date = new Date(), timezone: string = 'Asia/Tashkent'): string {
  const iana = getIanaTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: iana,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}
