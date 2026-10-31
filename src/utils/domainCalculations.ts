import {
  Habit,
  Goal,
  Task,
  Expense,
  UserSettings,
  HabitFrequency,
  Activity,
  ActivityCategory,
  ACTIVITY_CATEGORIES,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  HabitDayRecord,
} from '../types';

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
 * Synchronizes a single day's HabitDayRecord considering:
 * - manualCompleted / manualQuantity
 * - all individual activity contributions indexed by activityId
 * - targetQuantity and hasQuantity rules
 */
export function syncHabitDayRecord(
  currentRecord: HabitDayRecord | undefined,
  habit: Habit
): HabitDayRecord {
  const manualCompleted =
    currentRecord?.manualCompleted ?? (!currentRecord?.activityContributions ? !!currentRecord?.completed : false);
  const manualQuantity =
    currentRecord?.manualQuantity ?? (!currentRecord?.activityContributions ? (currentRecord?.quantity || 0) : 0);

  const actContributions = currentRecord?.activityContributions || {};
  let totalActQty = 0;
  for (const contrib of Object.values(actContributions)) {
    if (typeof contrib.quantity === 'number' && Number.isFinite(contrib.quantity) && contrib.quantity > 0) {
      totalActQty += contrib.quantity;
    }
  }

  const newTotalQty = manualQuantity + totalActQty;
  const hasAnyActivity = Object.keys(actContributions).length > 0;

  const isCompleted = habit.hasQuantity
    ? (habit.targetQuantity ? newTotalQty >= habit.targetQuantity : newTotalQty > 0)
    : (manualCompleted || hasAnyActivity);

  return {
    ...currentRecord,
    completed: isCompleted,
    quantity: habit.hasQuantity ? newTotalQty : (newTotalQty > 0 ? newTotalQty : undefined),
    manualCompleted,
    manualQuantity,
    activityContributions: Object.keys(actContributions).length > 0 ? actContributions : undefined,
  };
}

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
  const currentRecord = habit.history[dateStr];
  const prevManualQty =
    currentRecord?.manualQuantity ?? (!currentRecord?.activityContributions ? (currentRecord?.quantity || 0) : 0);
  const newManualQty = Math.max(0, prevManualQty + deltaAmount);

  const updatedRecord = syncHabitDayRecord(
    {
      ...currentRecord,
      manualQuantity: newManualQty,
      timestamp,
    },
    habit
  );

  const prevQty = currentRecord?.quantity || 0;
  const newQty = updatedRecord.quantity || 0;
  const actualDelta = newQty - prevQty;

  const updatedHistory: Record<string, HabitDayRecord> = {
    ...habit.history,
    [dateStr]: updatedRecord,
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
 * Updates manualCompleted and recomputes day status.
 */
export function applyHabitCompletionStatus(
  habit: Habit,
  linkedGoal: Goal | undefined,
  dateStr: string,
  timestamp: string,
  targetCompleted: boolean = true
): { updatedHabit: Habit; updatedGoal?: Goal; wasAlreadyCompleted: boolean; actualDelta: number } {
  const currentRecord = habit.history[dateStr];
  const wasAlreadyCompleted = !!currentRecord?.completed;

  if (wasAlreadyCompleted === targetCompleted) {
    return {
      updatedHabit: habit,
      updatedGoal: linkedGoal,
      wasAlreadyCompleted,
      actualDelta: 0,
    };
  }

  const updatedRecord = syncHabitDayRecord(
    {
      ...currentRecord,
      manualCompleted: targetCompleted,
      timestamp,
    },
    habit
  );

  const prevQty = currentRecord?.quantity || 0;
  const newQty = updatedRecord.quantity || 0;
  const actualDelta = newQty - prevQty;

  const updatedHistory: Record<string, HabitDayRecord> = {
    ...habit.history,
    [dateStr]: updatedRecord,
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
  const currentRecord = habit.history[dateStr];
  const currentManualDone =
    currentRecord?.manualCompleted ?? (!currentRecord?.activityContributions ? !!currentRecord?.completed : false);
  const willBeCompleted = !currentManualDone;
  const { updatedHabit, updatedGoal, actualDelta } = applyHabitCompletionStatus(
    habit,
    linkedGoal,
    dateStr,
    timestamp,
    willBeCompleted
  );
  return { updatedHabit, updatedGoal, willBeCompleted, actualDelta };
}

/**
 * Applies adding or updating an activity's contribution on a habit and linked goal
 */
export function applyActivityContributionToHabit(
  habit: Habit,
  linkedGoal: Goal | undefined,
  activity: Activity,
  referenceDateStr: string = getDateStringInTimezone()
): { updatedHabit: Habit; updatedGoal?: Goal; actualDelta: number } {
  const dateStr = activity.localDate;
  const currentRecord = habit.history[dateStr];
  const prevContributions = currentRecord?.activityContributions || {};

  const nextContributions = {
    ...prevContributions,
    [activity.id]: {
      quantity: activity.quantity,
      timestamp: activity.createdAt,
    },
  };

  const updatedRecord = syncHabitDayRecord(
    {
      ...currentRecord,
      manualQuantity:
        currentRecord?.manualQuantity ??
        (!currentRecord?.activityContributions ? (currentRecord?.quantity || 0) : 0),
      manualCompleted:
        currentRecord?.manualCompleted ??
        (!currentRecord?.activityContributions ? !!currentRecord?.completed : false),
      activityContributions: nextContributions,
      timestamp: activity.createdAt,
    },
    habit
  );

  const prevQty = currentRecord?.quantity || 0;
  const newQty = updatedRecord.quantity || 0;
  const actualDelta = newQty - prevQty;

  const updatedHistory: Record<string, HabitDayRecord> = {
    ...habit.history,
    [dateStr]: updatedRecord,
  };

  const streakStats = calculateHabitStreakAndStats(
    updatedHistory,
    habit.frequency,
    habit.daysOfWeek,
    habit.targetDaysPerWeek,
    referenceDateStr,
    habit.bestStreak
  );

  const updatedHabit: Habit = {
    ...habit,
    history: updatedHistory,
    currentQuantityToday: updatedHistory[referenceDateStr]?.quantity ?? 0,
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
 * Removes an activity's contribution from a habit and linked goal
 */
export function removeActivityContributionFromHabit(
  habit: Habit,
  linkedGoal: Goal | undefined,
  activityId: string,
  activityDate: string,
  referenceDateStr: string = getDateStringInTimezone()
): { updatedHabit: Habit; updatedGoal?: Goal; actualDelta: number } {
  const currentRecord = habit.history[activityDate];
  if (!currentRecord || !currentRecord.activityContributions || !currentRecord.activityContributions[activityId]) {
    return { updatedHabit: habit, updatedGoal: linkedGoal, actualDelta: 0 };
  }

  const nextContributions = { ...currentRecord.activityContributions };
  delete nextContributions[activityId];

  const updatedRecord = syncHabitDayRecord(
    {
      ...currentRecord,
      manualQuantity: currentRecord.manualQuantity ?? 0,
      manualCompleted: currentRecord.manualCompleted ?? false,
      activityContributions: Object.keys(nextContributions).length > 0 ? nextContributions : undefined,
    },
    habit
  );

  const prevQty = currentRecord.quantity || 0;
  const newQty = updatedRecord.quantity || 0;
  const actualDelta = newQty - prevQty; // this will be negative or 0

  const updatedHistory: Record<string, HabitDayRecord> = {
    ...habit.history,
    [activityDate]: updatedRecord,
  };

  const streakStats = calculateHabitStreakAndStats(
    updatedHistory,
    habit.frequency,
    habit.daysOfWeek,
    habit.targetDaysPerWeek,
    referenceDateStr,
    habit.bestStreak
  );

  const updatedHabit: Habit = {
    ...habit,
    history: updatedHistory,
    currentQuantityToday: updatedHistory[referenceDateStr]?.quantity ?? 0,
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
    }
  | {
      action: 'error';
      shouldMarkCompletion: false;
      feedbackText: string;
    };

/**
 * Production decision function for habit / supplement intakes:
 *
 * Rules:
 * 1. Archived habits (isArchived === true) are never automatically selected.
 * 2. If targetHabitId is provided, authoritative match on active habits only:
 *    - If found: mark_completed (idempotent) or already_exists
 *    - If not found or archived: return explicit error action, NEVER fallback to another habit
 * 3. Exact matches:
 *    - If 1 exact match: mark_completed or already_exists
 *    - If >1 exact matches: disambiguation_needed
 * 4. Partial matches:
 *    - Even if length === 1: disambiguation_needed (never auto-mark without explicit confirmation)
 * 5. No matches: create_new
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
    if (!target) {
      return {
        action: 'error',
        shouldMarkCompletion: false,
        feedbackText: "❌ Belgilangan odat topilmadi yoki arxivlangan.",
      };
    }
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

  // Partial match policy: Even if only 1 partial match exists, require explicit user confirmation!
  if (partialMatches.length >= 1) {
    return {
      action: 'disambiguation_needed',
      candidates: partialMatches,
      shouldMarkCompletion: false,
      feedbackText: `🔍 "${request.title}" bo'yicha o'xshash odat topildi. Iltimos, tasdiqlang:`,
    };
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

/**
 * Calculates previous occurrence of a target day of week (1=Monday ... 7=Sunday)
 * relative to refDateYMD. Always returns a past date (< refDateYMD).
 */
export function getPreviousDayOfWeekYMD(refDateYMD: string, targetDay: number): string {
  const currentDay = getDayOfWeekFromYMD(refDateYMD);
  let diff = (currentDay - targetDay + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysToYMD(refDateYMD, -diff);
}

/**
 * Validates HH:mm time format (00:00 to 23:59)
 */
export function validateTimeHHMM(timeStr: string): boolean {
  if (typeof timeStr !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr.trim());
}

/**
 * Returns the YYYY-MM-DD date when a completed task was actually completed in the given timezone.
 *
 * Fallback rule:
 * If completedAt is missing (e.g. legacy data imported from older versions) or invalid,
 * fall back to the task's scheduled `date` (YYYY-MM-DD).
 */
export function getTaskCompletionDateInTimezone(task: Task, timezone: string = 'Asia/Tashkent'): string {
  if (task.completedAt) {
    try {
      const iana = getIanaTimezone(timezone);
      const d = new Date(task.completedAt);
      if (!isNaN(d.getTime())) {
        return getDateStringInTimezone(d, iana);
      }
    } catch {
      // fallback below
    }
  }
  return task.date;
}

/**
 * Validates Activity payload against domain rules:
 * - Title is non-empty string
 * - localDate is valid YMD and NOT in the future (<= todayStr)
 * - time, if present, is valid HH:mm
 * - category is a recognized ActivityCategory
 * - durationMinutes, if present, is a positive finite number (> 0)
 * - quantity, if present, is a positive finite number (> 0)
 * - linkedHabitId, if present, must exist in active habits; unit/quantity compatibility enforced
 * - linkedTaskId, if present, must exist in tasks
 */
export function validateActivity(
  activity: Partial<Activity>,
  todayStr: string,
  context?: { habits?: Habit[]; tasks?: Task[] }
): { isValid: boolean; error?: string } {
  if (!activity || typeof activity !== 'object') {
    return { isValid: false, error: "Faoliyat ma'lumotlari kiritilmagan." };
  }

  const title = typeof activity.title === 'string' ? activity.title.trim() : '';
  if (!title) {
    return { isValid: false, error: "Faoliyat sarlavhasi (nomi) kiritilishi shart." };
  }

  const localDate = typeof activity.localDate === 'string' ? activity.localDate.trim() : '';
  if (!localDate || !isValidYMD(localDate)) {
    return { isValid: false, error: `Kiritilgan sana yaroqsiz formatda (YYYY-MM-DD bo'lishi kerak): "${activity.localDate}"` };
  }

  // Bajarilgan faoliyat kelajak sanasiga kiritilishi mumkin emas
  if (localDate > todayStr) {
    return { isValid: false, error: `Bajarilgan faoliyat kelajak sanasiga (${localDate}) kiritilishi mumkin emas.` };
  }

  if (activity.time !== undefined && activity.time !== null && activity.time !== '') {
    if (!validateTimeHHMM(activity.time)) {
      return { isValid: false, error: `Vaqt formati noto'g'ri (HH:mm bo'lishi kerak): "${activity.time}"` };
    }
  }

  if (activity.category) {
    if (!ACTIVITY_CATEGORIES.includes(activity.category as ActivityCategory)) {
      return { isValid: false, error: `Noma'lum faoliyat toifasi: "${activity.category}"` };
    }
  }

  if (activity.durationMinutes !== undefined && activity.durationMinutes !== null) {
    if (typeof activity.durationMinutes !== 'number' || !Number.isFinite(activity.durationMinutes) || activity.durationMinutes <= 0) {
      return { isValid: false, error: "Davomiylik (durationMinutes) musbat chekli son bo'lishi shart." };
    }
  }

  if (activity.quantity !== undefined && activity.quantity !== null) {
    if (typeof activity.quantity !== 'number' || !Number.isFinite(activity.quantity) || activity.quantity <= 0) {
      return { isValid: false, error: "Miqdor (quantity) musbat chekli son bo'lishi shart." };
    }
  }

  if (context?.habits && activity.linkedHabitId) {
    const targetHabit = context.habits.find(h => h.id === activity.linkedHabitId);
    if (!targetHabit) {
      return { isValid: false, error: "Bog'langan odat topilmadi." };
    }
    if (targetHabit.isArchived) {
      return { isValid: false, error: "Arxivlangan odatga faoliyat bog'lab bo'lmaydi." };
    }
    if (targetHabit.hasQuantity) {
      if (activity.quantity === undefined || activity.quantity === null) {
        return { isValid: false, error: `Ushbu odat miqdorli (${targetHabit.unit || 'birlik'}), faoliyatda miqdor ko'rsatilishi shart.` };
      }
      if (activity.unit && targetHabit.unit && !areUnitsCompatible(activity.unit, targetHabit.unit)) {
        return { isValid: false, error: `Birliklar mos kelmadi: faoliyat birligi "${activity.unit}", odat birligi "${targetHabit.unit}".` };
      }
    }
  }

  if (context?.tasks && activity.linkedTaskId) {
    const targetTask = context.tasks.find(t => t.id === activity.linkedTaskId);
    if (!targetTask) {
      return { isValid: false, error: "Bog'langan vazifa topilmadi." };
    }
  }

  return { isValid: true };
}

export interface CalendarPeriodSummary {
  period: 'hafta' | 'oy' | 'yil';
  startDate: string;
  endDate: string;
  totalActivities: number;
  activeDaysCount: number;
  totalActiveDaysCount: number;
  categoryBreakdown: Record<ActivityCategory, { count: number; totalDurationMinutes: number }>;
  totalDurationMinutes: number;
  durationsCount: number;
  unitQuantities: Record<string, number>;
  standaloneHabitCompletions: number;
  completedTasksCount: number;
  totalEventsCount: number;
}

/**
 * Returns exact start and end dates (YYYY-MM-DD) for a given calendar period
 */
export function getCalendarPeriodBounds(
  period: 'hafta' | 'oy' | 'yil',
  refDateStr: string
): { startDate: string; endDate: string } {
  const parts = refDateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];

  if (period === 'hafta') {
    const dayOfWeek = getDayOfWeekFromYMD(refDateStr); // 1 = Monday, 7 = Sunday
    const startDate = addDaysToYMD(refDateStr, -(dayOfWeek - 1));
    const endDate = addDaysToYMD(refDateStr, 7 - dayOfWeek);
    return { startDate, endDate };
  }

  if (period === 'oy') {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

/**
 * Deterministic period summary calculation:
 * - Activity count, distinct active days
 * - Category breakdown with counts and durations
 * - Total duration of entries with duration (no fabricated duration!)
 * - Quantities grouped strictly by unit (never adding minutes, pages, and km together)
 * - Standalone habit completions deduplicated against linked activities
 * - Completed tasks deduplicated against linkedTaskId activities
 * - Actual completion dates resolved in user timezone with fallback to task.date
 */
export function calculateCalendarPeriodSummary(
  activities: Activity[],
  habits: Habit[],
  tasks: Task[],
  period: 'hafta' | 'oy' | 'yil',
  refDateStr: string,
  timezone: string = 'Asia/Tashkent'
): CalendarPeriodSummary {
  const { startDate, endDate } = getCalendarPeriodBounds(period, refDateStr);

  const periodActivities = activities.filter(
    a => a.localDate >= startDate && a.localDate <= endDate
  );

  const totalActivities = periodActivities.length;
  const activityDaysSet = new Set<string>();
  const totalActiveDaysSet = new Set<string>();

  const categoryBreakdown: Record<ActivityCategory, { count: number; totalDurationMinutes: number }> = {
    sport: { count: 0, totalDurationMinutes: 0 },
    salomatlik: { count: 0, totalDurationMinutes: 0 },
    talim: { count: 0, totalDurationMinutes: 0 },
    ish: { count: 0, totalDurationMinutes: 0 },
    shaxsiy: { count: 0, totalDurationMinutes: 0 },
    boshqa: { count: 0, totalDurationMinutes: 0 },
  };

  let totalDurationMinutes = 0;
  let durationsCount = 0;
  const unitQuantities: Record<string, number> = {};

  for (const act of periodActivities) {
    activityDaysSet.add(act.localDate);
    totalActiveDaysSet.add(act.localDate);

    const cat: ActivityCategory = (ACTIVITY_CATEGORIES as readonly string[]).includes(act.category)
      ? act.category
      : 'boshqa';

    categoryBreakdown[cat].count += 1;

    if (typeof act.durationMinutes === 'number' && Number.isFinite(act.durationMinutes) && act.durationMinutes > 0) {
      categoryBreakdown[cat].totalDurationMinutes += act.durationMinutes;
      totalDurationMinutes += act.durationMinutes;
      durationsCount += 1;
    }

    if (typeof act.quantity === 'number' && Number.isFinite(act.quantity) && act.quantity > 0 && act.unit) {
      const u = act.unit.trim().toLowerCase();
      unitQuantities[u] = (unitQuantities[u] || 0) + act.quantity;
    }
  }

  // Standalone habit completions:
  // Count habit completions that do NOT have a corresponding linked activity on the same date
  let standaloneHabitCompletions = 0;
  for (const h of habits) {
    if (!h.history) continue;
    for (const [dateStr, record] of Object.entries(h.history)) {
      if (record && record.completed && dateStr >= startDate && dateStr <= endDate) {
        const hasLinkedActivity = periodActivities.some(
          a => a.localDate === dateStr && a.linkedHabitId === h.id
        );
        if (!hasLinkedActivity) {
          standaloneHabitCompletions += 1;
          totalActiveDaysSet.add(dateStr);
        }
      }
    }
  }

  // Completed tasks count in period (using actual completion date in user timezone)
  const linkedTaskIdsInPeriod = new Set(
    periodActivities.map(a => a.linkedTaskId).filter(Boolean) as string[]
  );

  const completedTasksInPeriod = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    const compDate = getTaskCompletionDateInTimezone(t, timezone);
    return compDate >= startDate && compDate <= endDate;
  });

  const standaloneCompletedTasks = completedTasksInPeriod.filter(
    t => !linkedTaskIdsInPeriod.has(t.id)
  );

  standaloneCompletedTasks.forEach(t => {
    const compDate = getTaskCompletionDateInTimezone(t, timezone);
    totalActiveDaysSet.add(compDate);
  });

  return {
    period,
    startDate,
    endDate,
    totalActivities,
    activeDaysCount: activityDaysSet.size,
    totalActiveDaysCount: totalActiveDaysSet.size,
    categoryBreakdown,
    totalDurationMinutes,
    durationsCount,
    unitQuantities,
    standaloneHabitCompletions,
    completedTasksCount: standaloneCompletedTasks.length,
    totalEventsCount: totalActivities + standaloneHabitCompletions + standaloneCompletedTasks.length,
  };
}

export interface BackupValidationContext {
  todayStr: string;
  currentTasks: Task[];
  currentHabits: Habit[];
  currentGoals: Goal[];
  currentExpenses: Expense[];
  currentActivities: Activity[];
  currentSettings: UserSettings;
}

export interface CandidateBackupData {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  expenses: Expense[];
  activities: Activity[];
  settings?: Partial<UserSettings>;
}

export type BackupValidationResult =
  | {
      isValid: true;
      candidateData: CandidateBackupData;
      loadedCount: number;
    }
  | {
      isValid: false;
      error: string;
    };

/**
 * Pure candidate-state import validator.
 * Validates all collections, foreign keys, internal history structures,
 * non-duplicate IDs, and activity contributions.
 * Guarantees all-or-nothing candidate readiness before any state mutation.
 */
export function parseAndValidateBackup(
  jsonStr: string,
  context: BackupValidationContext
): BackupValidationResult {
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) {
    return { isValid: false, error: "Zaxira nusxasi matni bo'sh bo'lishi mumkin emas." };
  }

  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return { isValid: false, error: "JSON fayli formati noto'g'ri yoki buzilgan." };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { isValid: false, error: "Zaxira nusxasi ob'ekt (JSON object) formatida bo'lishi kerak." };
  }

  // 1. Candidate Tasks
  let candidateTasks: Task[] = context.currentTasks;
  if ('tasks' in data) {
    if (!Array.isArray(data.tasks)) {
      return { isValid: false, error: "Tasks maydoni massiv (array) bo'lishi kerak." };
    }
    const seenTaskIds = new Set<string>();
    for (const t of data.tasks) {
      if (!t || typeof t !== 'object') {
        return { isValid: false, error: "Vazifalar ichida yaroqsiz yozuv topildi." };
      }
      if (typeof t.id !== 'string' || !t.id.trim()) {
        return { isValid: false, error: "Vazifaning ID'si kiritilmagan yoki bo'sh." };
      }
      if (seenTaskIds.has(t.id)) {
        return { isValid: false, error: `Takroriy vazifa ID'si aniqlandi: "${t.id}"` };
      }
      seenTaskIds.add(t.id);

      if (typeof t.title !== 'string' || !t.title.trim()) {
        return { isValid: false, error: `Vazifaning sarlavhasi (title) bo'sh: "${t.id}"` };
      }
      if (typeof t.date !== 'string' || !isValidYMD(t.date)) {
        return { isValid: false, error: `Vazifa sanasi noto'g'ri formatda (YYYY-MM-DD kutilgan): "${t.date}"` };
      }
      if (t.time !== undefined && t.time !== null && t.time !== '') {
        if (!validateTimeHHMM(t.time)) {
          return { isValid: false, error: `Vazifa vaqti noto'g'ri formatda (HH:mm kutilgan): "${t.time}"` };
        }
      }
      const validTaskStatuses = ['pending', 'completed', 'postponed', 'cancelled'];
      if (t.status && !validTaskStatuses.includes(t.status)) {
        return { isValid: false, error: `Vazifaning statusi yaroqsiz: "${t.status}"` };
      }
      if (t.priority && !['low', 'medium', 'high'].includes(t.priority)) {
        return { isValid: false, error: `Vazifaning ustuvorligi (priority) yaroqsiz: "${t.priority}"` };
      }
      if (t.category && !['vazifa', 'uchrashuv'].includes(t.category)) {
        return { isValid: false, error: `Vazifaning toifasi (category) yaroqsiz: "${t.category}"` };
      }
    }
    candidateTasks = data.tasks;
  }

  // 2. Candidate Habits
  let candidateHabits: Habit[] = context.currentHabits;
  if ('habits' in data) {
    if (!Array.isArray(data.habits)) {
      return { isValid: false, error: "Habits maydoni massiv (array) bo'lishi kerak." };
    }
    const seenHabitIds = new Set<string>();
    for (const h of data.habits) {
      if (!h || typeof h !== 'object') {
        return { isValid: false, error: "Odatlar ichida yaroqsiz yozuv topildi." };
      }
      if (typeof h.id !== 'string' || !h.id.trim()) {
        return { isValid: false, error: "Odatning ID'si kiritilmagan yoki bo'sh." };
      }
      if (seenHabitIds.has(h.id)) {
        return { isValid: false, error: `Takroriy odat ID'si aniqlandi: "${h.id}"` };
      }
      seenHabitIds.add(h.id);

      if (typeof h.title !== 'string' || !h.title.trim()) {
        return { isValid: false, error: `Odatning sarlavhasi (title) bo'sh: "${h.id}"` };
      }
      if (!['daily', 'weekly_target', 'specific_days'].includes(h.frequency)) {
        return { isValid: false, error: `Odat takrorlanish formati (frequency) yaroqsiz: "${h.frequency}"` };
      }
      if (h.frequency === 'specific_days') {
        if (!Array.isArray(h.daysOfWeek) || h.daysOfWeek.length === 0) {
          return { isValid: false, error: `Tanlangan kunlar (daysOfWeek) bo'sh bo'lishi mumkin emas: "${h.title}"` };
        }
        for (const d of h.daysOfWeek) {
          if (!Number.isInteger(d) || d < 1 || d > 7) {
            return { isValid: false, error: `Tanlangan kunlar (1..7 diapazonida butun son) yaroqsiz: ${d}` };
          }
        }
      }
      if (h.frequency === 'weekly_target') {
        if (typeof h.targetDaysPerWeek !== 'number' || !Number.isInteger(h.targetDaysPerWeek) || h.targetDaysPerWeek < 1 || h.targetDaysPerWeek > 7) {
          return { isValid: false, error: `Haftalik maqsad (targetDaysPerWeek) 1..7 orasida bo'lishi kerak: "${h.title}"` };
        }
      }
      if (h.streak !== undefined && (typeof h.streak !== 'number' || !Number.isFinite(h.streak) || h.streak < 0)) {
        return { isValid: false, error: `Odat streak qiymati yaroqsiz: "${h.title}"` };
      }
      if (h.bestStreak !== undefined && (typeof h.bestStreak !== 'number' || !Number.isFinite(h.bestStreak) || h.bestStreak < 0)) {
        return { isValid: false, error: `Odat bestStreak qiymati yaroqsiz: "${h.title}"` };
      }
      if (h.targetQuantity !== undefined && h.targetQuantity !== null) {
        if (typeof h.targetQuantity !== 'number' || !Number.isFinite(h.targetQuantity) || h.targetQuantity <= 0) {
          return { isValid: false, error: `Odat targetQuantity musbat chekli son bo'lishi kerak: "${h.title}"` };
        }
      }

      // Internal history structure validation
      if (h.history !== undefined && h.history !== null) {
        if (typeof h.history !== 'object' || Array.isArray(h.history)) {
          return { isValid: false, error: `Odat tarixi (history) ob'ekt bo'lishi kerak: "${h.title}"` };
        }
        for (const [dateKey, record] of Object.entries(h.history)) {
          if (!isValidYMD(dateKey)) {
            return { isValid: false, error: `Odat tarixidagi sana kaliti yaroqsiz (YYYY-MM-DD kutilgan): "${dateKey}"` };
          }
          if (!record || typeof record !== 'object') {
            return { isValid: false, error: `Odat tarixi yozuvi yaroqsiz: "${h.title}" -> "${dateKey}"` };
          }
          if (typeof (record as HabitDayRecord).completed !== 'boolean') {
            return { isValid: false, error: `Odat tarixi "completed" qiymati boolean bo'lishi shart: "${h.title}" -> "${dateKey}"` };
          }
          const qty = (record as HabitDayRecord).quantity;
          if (qty !== undefined && (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0)) {
            return { isValid: false, error: `Odat tarixi quantity qiymati manfiy bo'lmasligi kerak: "${h.title}" -> "${dateKey}"` };
          }
          const contribs = (record as HabitDayRecord).activityContributions;
          if (contribs !== undefined && contribs !== null) {
            if (typeof contribs !== 'object' || Array.isArray(contribs)) {
              return { isValid: false, error: `Odat tarixi activityContributions ob'ekt bo'lishi kerak: "${h.title}" -> "${dateKey}"` };
            }
            for (const [actKey, cVal] of Object.entries(contribs)) {
              if (!actKey || typeof actKey !== 'string') {
                return { isValid: false, error: `Faoliyat hissasining kaliti yaroqsiz: "${h.title}"` };
              }
              if (!cVal || typeof cVal !== 'object') {
                return { isValid: false, error: `Faoliyat hissasi qiymati ob'ekt bo'lishi kerak: "${h.title}" -> "${actKey}"` };
              }
              if (cVal.quantity !== undefined && (typeof cVal.quantity !== 'number' || !Number.isFinite(cVal.quantity) || cVal.quantity <= 0)) {
                return { isValid: false, error: `Faoliyat hissasi miqdori (quantity) musbat chekli son bo'lishi kerak: "${actKey}"` };
              }
            }
          }
        }
      }
    }
    candidateHabits = data.habits;
  }

  // 3. Candidate Goals
  let candidateGoals: Goal[] = context.currentGoals;
  if ('goals' in data) {
    if (!Array.isArray(data.goals)) {
      return { isValid: false, error: "Goals maydoni massiv (array) bo'lishi kerak." };
    }
    const seenGoalIds = new Set<string>();
    for (const g of data.goals) {
      if (!g || typeof g !== 'object') {
        return { isValid: false, error: "Maqsadlar ichida yaroqsiz yozuv topildi." };
      }
      if (typeof g.id !== 'string' || !g.id.trim()) {
        return { isValid: false, error: "Maqsadning ID'si kiritilmagan yoki bo'sh." };
      }
      if (seenGoalIds.has(g.id)) {
        return { isValid: false, error: `Takroriy maqsad ID'si aniqlandi: "${g.id}"` };
      }
      seenGoalIds.add(g.id);

      if (typeof g.title !== 'string' || !g.title.trim()) {
        return { isValid: false, error: `Maqsadning sarlavhasi (title) bo'sh: "${g.id}"` };
      }
      if (typeof g.targetValue !== 'number' || !Number.isFinite(g.targetValue) || g.targetValue <= 0) {
        return { isValid: false, error: `Maqsad targetValue musbat chekli son bo'lishi shart: "${g.title}"` };
      }
      if (typeof g.currentValue !== 'number' || !Number.isFinite(g.currentValue) || g.currentValue < 0) {
        return { isValid: false, error: `Maqsad currentValue manfiy bo'lmagan chekli son bo'lishi shart: "${g.title}"` };
      }
      if (typeof g.unit !== 'string' || !g.unit.trim()) {
        return { isValid: false, error: `Maqsad birligi (unit) kiritilishi shart: "${g.title}"` };
      }
      if (!['active', 'achieved', 'paused'].includes(g.status)) {
        return { isValid: false, error: `Maqsad statusi yaroqsiz: "${g.status}"` };
      }
      if (g.goalType && !['reach', 'decrease'].includes(g.goalType)) {
        return { isValid: false, error: `Maqsad turi (goalType) yaroqsiz: "${g.goalType}"` };
      }
      if (typeof g.deadline !== 'string' || !isValidYMD(g.deadline)) {
        return { isValid: false, error: `Maqsad muddati (deadline) noto'g'ri (YYYY-MM-DD kutilgan): "${g.deadline}"` };
      }
      if (g.progressLogs !== undefined && !Array.isArray(g.progressLogs)) {
        return { isValid: false, error: `Maqsad progressLogs maydoni massiv bo'lishi kerak: "${g.title}"` };
      }
      if (g.internalHabits !== undefined && !Array.isArray(g.internalHabits)) {
        return { isValid: false, error: `Maqsad internalHabits maydoni massiv bo'lishi kerak: "${g.title}"` };
      }
    }
    candidateGoals = data.goals;
  }

  // 4. Candidate Expenses
  let candidateExpenses: Expense[] = context.currentExpenses;
  if ('expenses' in data) {
    if (!Array.isArray(data.expenses)) {
      return { isValid: false, error: "Expenses maydoni massiv (array) bo'lishi kerak." };
    }
    const seenExpIds = new Set<string>();
    for (const e of data.expenses) {
      if (!e || typeof e !== 'object') {
        return { isValid: false, error: "Xarajatlar ichida yaroqsiz yozuv topildi." };
      }
      if (typeof e.id !== 'string' || !e.id.trim()) {
        return { isValid: false, error: "Xarajatning ID'si kiritilmagan yoki bo'sh." };
      }
      if (seenExpIds.has(e.id)) {
        return { isValid: false, error: `Takroriy xarajat ID'si aniqlandi: "${e.id}"` };
      }
      seenExpIds.add(e.id);

      if (typeof e.title !== 'string' || !e.title.trim()) {
        return { isValid: false, error: `Xarajat sarlavhasi (title) bo'sh: "${e.id}"` };
      }
      if (typeof e.amount !== 'number' || !Number.isFinite(e.amount) || e.amount <= 0) {
        return { isValid: false, error: `Xarajat summasi (amount) musbat chekli son bo'lishi shart: "${e.title}"` };
      }
      if (typeof e.date !== 'string' || !isValidYMD(e.date)) {
        return { isValid: false, error: `Xarajat sanasi noto'g'ri (YYYY-MM-DD kutilgan): "${e.date}"` };
      }
      if (e.currency && !['UZS', 'USD'].includes(e.currency)) {
        return { isValid: false, error: `Xarajat valyutasi yaroqsiz: "${e.currency}"` };
      }
      if (!EXPENSE_CATEGORIES.includes(e.category)) {
        return { isValid: false, error: `Xarajat toifasi yaroqsiz: "${e.category}"` };
      }
    }
    candidateExpenses = data.expenses;
  }

  // 5. Candidate Activities
  let candidateActivities: Activity[] = [];
  if ('activities' in data) {
    if (!Array.isArray(data.activities)) {
      return { isValid: false, error: "Activities maydoni massiv (array) bo'lishi kerak." };
    }
    const seenActIds = new Set<string>();
    for (const act of data.activities) {
      if (!act || typeof act !== 'object') {
        return { isValid: false, error: "Faoliyatlar ichida yaroqsiz yozuv topildi." };
      }
      if (typeof act.id !== 'string' || !act.id.trim()) {
        return { isValid: false, error: "Faoliyat ID'si kiritilmagan yoki bo'sh." };
      }
      if (seenActIds.has(act.id)) {
        return { isValid: false, error: `Takroriy faoliyat ID'si aniqlandi: "${act.id}"` };
      }
      seenActIds.add(act.id);

      const val = validateActivity(act, context.todayStr, {
        habits: candidateHabits,
        tasks: candidateTasks,
      });
      if (!val.isValid) {
        return { isValid: false, error: `Faoliyat validatsiyadan o'tmadi: ${val.error}` };
      }
    }
    candidateActivities = data.activities;
  } else {
    // Legacy backup without 'activities' key: keep existing activities,
    // but strictly verify their foreign keys against candidate habits and tasks!
    candidateActivities = context.currentActivities;
    for (const act of candidateActivities) {
      if (act.linkedHabitId) {
        const habitExists = candidateHabits.some(h => h.id === act.linkedHabitId);
        if (!habitExists) {
          return {
            isValid: false,
            error: `Eski zaxira nusxasini tiklab bo'lmadi: mavjud faoliyat bog'langan odat ("${act.linkedHabitId}") zaxira nusxasida mavjud emas.`,
          };
        }
      }
      if (act.linkedTaskId) {
        const taskExists = candidateTasks.some(t => t.id === act.linkedTaskId);
        if (!taskExists) {
          return {
            isValid: false,
            error: `Eski zaxira nusxasini tiklab bo'lmadi: mavjud faoliyat bog'langan vazifa ("${act.linkedTaskId}") zaxira nusxasida mavjud emas.`,
          };
        }
      }
    }
  }

  // 6. Cross-Entity Foreign Key Integrity & Two-Way Activity Contributions Verification
  const activityMap = new Map<string, Activity>(candidateActivities.map(a => [a.id, a]));
  const seenContributedActivityKeys = new Map<string, { habitId: string; habitTitle: string; dateStr: string }>();

  // A. Habit -> Goal linkage and Habit History -> Activity Contributions Verification (Forward Check)
  for (const h of candidateHabits) {
    if (h.linkedGoalId) {
      const goalExists = candidateGoals.some(g => g.id === h.linkedGoalId);
      if (!goalExists) {
        return {
          isValid: false,
          error: `Odat ("${h.title}") bog'langan maqsad ID'si ("${h.linkedGoalId}") maqsadlar ro'yxatida topilmadi.`,
        };
      }
    }

    if (h.history) {
      for (const [dStr, rec] of Object.entries(h.history)) {
        if (!rec) continue;

        // 1. Contributions integrity
        if (rec.activityContributions) {
          for (const [actId, contrib] of Object.entries(rec.activityContributions)) {
            const act = activityMap.get(actId);
            if (!act) {
              return {
                isValid: false,
                error: `Odat ("${h.title}") tarixidagi hissa ID'si ("${actId}") faoliyatlar ro'yxatida topilmadi (bog'lanish buzilgan).`,
              };
            }

            // activity.linkedHabitId aynan history egasi bo'lgan odat ID'siga teng bo'lsin
            if (act.linkedHabitId !== h.id) {
              return {
                isValid: false,
                error: `Faoliyat ("${act.title}", ID: "${act.id}") "${act.linkedHabitId}" odatiga bog'langan, ammo "${h.title}" (ID: "${h.id}") tarixiga hissa sifatida yozilgan.`,
              };
            }

            // activity.localDate aynan history sanasiga teng bo'lsin
            if (act.localDate !== dStr) {
              return {
                isValid: false,
                error: `Faoliyat ("${act.title}") sanasi (${act.localDate}) odat tarixidagi sanaga (${dStr}) mos kelmadi.`,
              };
            }

            // miqdorli odatda contribution.quantity faoliyat quantity qiymatiga mos bo'lsin va birliklar mos bo'lsin
            if (h.hasQuantity) {
              if (contrib.quantity !== act.quantity) {
                return {
                  isValid: false,
                  error: `Faoliyat ("${act.title}") hissasi miqdori (${contrib.quantity}) faoliyatning o'z miqdoriga (${act.quantity}) mos kelmadi.`,
                };
              }
              if (act.unit && h.unit && !areUnitsCompatible(act.unit, h.unit)) {
                return {
                  isValid: false,
                  error: `Faoliyat birligi ("${act.unit}") bilan odat birligi ("${h.unit}") mos kelmadi.`,
                };
              }
            }

            // bir faoliyat hissasi boshqa odat yoki sanada takror yozilmasin
            if (seenContributedActivityKeys.has(actId)) {
              const prev = seenContributedActivityKeys.get(actId)!;
              return {
                isValid: false,
                error: `Faoliyat ("${act.title}", ID: "${actId}") bir necha joyda hissa sifatida yozilgan: avval "${prev.habitTitle}" (${prev.dateStr}), keyin "${h.title}" (${dStr}).`,
              };
            }
            seenContributedActivityKeys.set(actId, { habitId: h.id, habitTitle: h.title, dateStr: dStr });
          }
        }

        // 2. Quantity & Completed Consistency:
        // history.quantity va completed qiymatlari manual hissa + faoliyat hissalaridan chiqadigan natijaga mos bo'lsin
        const expectedRecord = syncHabitDayRecord(rec, h);
        if (h.hasQuantity && rec.quantity !== expectedRecord.quantity) {
          return {
            isValid: false,
            error: `Odat ("${h.title}") ${dStr} sanasidagi quantity (${rec.quantity}) hisoblangan umumiy miqdorga (${expectedRecord.quantity}) mos kelmadi.`,
          };
        }
        if (rec.completed !== expectedRecord.completed) {
          return {
            isValid: false,
            error: `Odat ("${h.title}") ${dStr} sanasidagi completed holati (${rec.completed}) hisoblangan natijaga (${expectedRecord.completed}) mos kelmadi.`,
          };
        }
      }
    }
  }

  // B. Activity -> Habit History Verification (Reverse Check)
  // Odatga bog'langan har bir yangi formatdagi faoliyatning tegishli history hissasi mavjud bo'lsin
  for (const act of candidateActivities) {
    if (act.linkedHabitId) {
      const targetHabit = candidateHabits.find(h => h.id === act.linkedHabitId);
      if (!targetHabit) {
        return {
          isValid: false,
          error: `Faoliyat ("${act.title}") bog'langan odat ("${act.linkedHabitId}") topilmadi.`,
        };
      }
      const dayRec = targetHabit.history?.[act.localDate];
      if (!dayRec || !dayRec.activityContributions || !dayRec.activityContributions[act.id]) {
        return {
          isValid: false,
          error: `Faoliyat ("${act.title}", ID: "${act.id}") "${targetHabit.title}" odatiga (${act.localDate}) bog'langan, ammo odat tarixida tegishli hissa topilmadi.`,
        };
      }
    }
  }

  // C. Goal -> Habit linkage
  for (const g of candidateGoals) {
    if (Array.isArray(g.linkedHabitIds)) {
      for (const hid of g.linkedHabitIds) {
        const habitExists = candidateHabits.some(h => h.id === hid);
        if (!habitExists) {
          return {
            isValid: false,
            error: `Maqsad ("${g.title}") bog'langan odat ID'si ("${hid}") odatlar ro'yxatida topilmadi.`,
          };
        }
      }
    }
  }

  // 7. Settings validation
  let candidateSettings: Partial<UserSettings> | undefined;
  if ('settings' in data) {
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      return { isValid: false, error: "Settings maydoni ob'ekt bo'lishi kerak." };
    }
    const s = data.settings;

    if (typeof s.name !== 'string' || !s.name.trim()) {
      return { isValid: false, error: "Sozlamalardagi ism (name) satr bo'lishi shart." };
    }
    if (typeof s.username !== 'string') {
      return { isValid: false, error: "Sozlamalardagi username satr bo'lishi shart." };
    }
    if (typeof s.timezone !== 'string' || !s.timezone.trim()) {
      return { isValid: false, error: "Sozlamalardagi vaqt mintaqasi (timezone) satr bo'lishi shart." };
    }

    // Legacy formatni hisobga olgan holda haqiqiy IANA zonaga tekshirish:
    // masalan: "Asia/Tashkent (UZT)" -> "Asia/Tashkent"
    const cleanTz = s.timezone.split(' ')[0].trim();
    let isIanaValid = false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: cleanTz });
      isIanaValid = true;
    } catch {
      isIanaValid = false;
    }
    if (!isIanaValid) {
      return { isValid: false, error: `Sozlamalardagi vaqt mintaqasi (timezone) yaroqsiz: "${s.timezone}"` };
    }

    if (typeof s.morningTime !== 'string' || !validateTimeHHMM(s.morningTime)) {
      return { isValid: false, error: `Ertalabki rejalashtirish vaqti (morningTime) noto'g'ri (HH:mm kutilgan): "${s.morningTime}"` };
    }
    if (typeof s.eveningTime !== 'string' || !validateTimeHHMM(s.eveningTime)) {
      return { isValid: false, error: `Kechki sarhisob vaqti (eveningTime) noto'g'ri (HH:mm kutilgan): "${s.eveningTime}"` };
    }

    if (typeof s.reminderSound !== 'boolean') {
      return { isValid: false, error: "Eslatma ovozi (reminderSound) boolean bo'lishi shart." };
    }
    if (typeof s.aiEnabled !== 'boolean') {
      return { isValid: false, error: "AI yordamchisi (aiEnabled) boolean bo'lishi shart." };
    }

    if (s.monthlyExpenseBudget !== undefined && s.monthlyExpenseBudget !== null) {
      if (typeof s.monthlyExpenseBudget !== 'number' || !Number.isFinite(s.monthlyExpenseBudget) || s.monthlyExpenseBudget < 0) {
        return { isValid: false, error: "Oylik byudjet (monthlyExpenseBudget) manfiy bo'lmagan chekli son bo'lishi shart." };
      }
    }

    // Noma'lum maydonlarni to'g'ridan-to'g'ri spread qilmasdan, faqat ruxsat etilgan maydonlarni qabul qilamiz:
    candidateSettings = {
      name: s.name.trim(),
      username: s.username.trim(),
      timezone: s.timezone.trim(),
      morningTime: s.morningTime.trim(),
      eveningTime: s.eveningTime.trim(),
      reminderSound: s.reminderSound,
      aiEnabled: s.aiEnabled,
      ...(s.monthlyExpenseBudget !== undefined && s.monthlyExpenseBudget !== null
        ? { monthlyExpenseBudget: s.monthlyExpenseBudget }
        : {}),
    };
  }

  const loadedCount =
    candidateTasks.length +
    candidateHabits.length +
    candidateGoals.length +
    candidateExpenses.length +
    candidateActivities.length;

  return {
    isValid: true,
    candidateData: {
      tasks: candidateTasks,
      habits: candidateHabits,
      goals: candidateGoals,
      expenses: candidateExpenses,
      activities: candidateActivities,
      settings: candidateSettings,
    },
    loadedCount,
  };
}

