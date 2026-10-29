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
 */
export function calculateHabitStreakAndStats(
  history: Record<string, { completed: boolean; quantity?: number }>,
  frequency: HabitFrequency,
  daysOfWeek: number[] = [1, 2, 3, 4, 5, 6, 7],
  targetDaysPerWeek: number = 3,
  referenceDateStr: string = getDateStringInTimezone(),
  existingBestStreak: number = 0
): HabitStreakStats {
  if (frequency === 'weekly_target') {
    return calculateWeeklyTargetStats(history, targetDaysPerWeek, referenceDateStr, existingBestStreak);
  }

  if (frequency === 'specific_days') {
    return calculateSpecificDaysStreak(history, daysOfWeek, referenceDateStr, existingBestStreak);
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

  // Calculate pure best streak across all history
  const completedDates = Object.keys(history)
    .filter(d => history[d]?.completed)
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

  const bestStreak = Math.max(existingBestStreak, maxStreak, currentStreak);

  return { streak: currentStreak, bestStreak };
}

function calculateSpecificDaysStreak(
  history: Record<string, { completed: boolean; quantity?: number }>,
  scheduledDays: number[],
  referenceDateStr: string,
  existingBestStreak: number
): HabitStreakStats {
  const activeScheduledDays = scheduledDays.length > 0 ? scheduledDays : [1, 2, 3, 4, 5, 6, 7];

  const getPreviousScheduledDate = (fromDate: string): string => {
    let curr = addDaysToYMD(fromDate, -1);
    while (!activeScheduledDays.includes(getDayOfWeekFromYMD(curr))) {
      curr = addDaysToYMD(curr, -1);
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

  const bestStreak = Math.max(existingBestStreak, currentStreak);
  return { streak: currentStreak, bestStreak };
}

function calculateWeeklyTargetStats(
  history: Record<string, { completed: boolean; quantity?: number }>,
  targetDaysPerWeek: number,
  referenceDateStr: string,
  existingBestStreak: number
): HabitStreakStats {
  // Find Monday of the current week containing referenceDateStr
  const currentDayOfWeek = getDayOfWeekFromYMD(referenceDateStr); // 1..7
  const currentMonday = addDaysToYMD(referenceDateStr, -(currentDayOfWeek - 1));

  // Count completions in current week (Monday to Sunday)
  let currentWeekCompletions = 0;
  for (let i = 0; i < 7; i++) {
    const dayStr = addDaysToYMD(currentMonday, i);
    if (history[dayStr]?.completed) {
      currentWeekCompletions += 1;
    }
  }

  // Count consecutive weeks target was met
  let weeklyStreak = 0;
  let checkMonday = currentMonday;

  const currentWeekMet = currentWeekCompletions >= targetDaysPerWeek;
  if (currentWeekMet) {
    weeklyStreak = 1;
    checkMonday = addDaysToYMD(currentMonday, -7);
  } else {
    // Current week not yet met; check if previous week was met
    const prevMonday = addDaysToYMD(currentMonday, -7);
    let prevCompletions = 0;
    for (let i = 0; i < 7; i++) {
      const dayStr = addDaysToYMD(prevMonday, i);
      if (history[dayStr]?.completed) prevCompletions += 1;
    }
    if (prevCompletions >= targetDaysPerWeek) {
      weeklyStreak = 1;
      checkMonday = addDaysToYMD(prevMonday, -7);
    } else {
      checkMonday = null as any;
    }
  }

  while (checkMonday) {
    let weekCompletions = 0;
    for (let i = 0; i < 7; i++) {
      const dayStr = addDaysToYMD(checkMonday, i);
      if (history[dayStr]?.completed) weekCompletions += 1;
    }
    if (weekCompletions >= targetDaysPerWeek) {
      weeklyStreak += 1;
      checkMonday = addDaysToYMD(checkMonday, -7);
    } else {
      break;
    }
  }

  const bestStreak = Math.max(existingBestStreak, weeklyStreak);
  return {
    streak: weeklyStreak,
    bestStreak,
    weeklyCompletions: currentWeekCompletions,
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
  const targetQty = habit.targetQuantity || 1;
  const newQty = willBeCompleted ? targetQty : 0;
  const prevQty = currentRecord.quantity || 0;
  const actualDelta = newQty - prevQty;

  const updatedHistory = {
    ...habit.history,
    [dateStr]: {
      completed: willBeCompleted,
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

  return { updatedHabit, updatedGoal, willBeCompleted, actualDelta };
}

/**
 * Calculates task postponing with midnight rollover and sensible untimed default
 *
 * Rules:
 * - If minutesOrDate is a date string (e.g. YYYY-MM-DD): update date, keep time, status = 'postponed'
 * - If minutesOrDate is a number (minutes):
 *     1. Start from task.date (default to today if missing).
 *     2. Time baseline:
 *        - If task.time exists: use task.time (HH:mm)
 *        - If task.time does NOT exist:
 *            * If task.date === today: baseline is current time in timezone (now)
 *            * If task.date !== today: baseline is 09:00
 *     3. Add minutes. If crosses midnight (e.g. 23:50 + 15m -> 00:05), date increments to next day.
 */
export function calculatePostponedTask(
  task: Task,
  minutesOrDate: number | string,
  now: Date = new Date(),
  timezone: string = 'Asia/Tashkent'
): Partial<Task> {
  if (typeof minutesOrDate === 'string') {
    return {
      date: minutesOrDate,
      status: 'postponed',
      postponedUntil: minutesOrDate,
    };
  }

  const minutesToAdd = minutesOrDate;
  const todayStr = getDateStringInTimezone(now, timezone);
  const baseDate = task.date || todayStr;

  let baseHours = 9;
  let baseMinutes = 0;

  if (task.time) {
    const [h, m] = task.time.split(':').map(Number);
    baseHours = isNaN(h) ? 9 : h;
    baseMinutes = isNaN(m) ? 0 : m;
  } else if (baseDate === todayStr) {
    // Current time in specified timezone
    const iana = getIanaTimezone(timezone);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: iana,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now).split(':').map(Number);
    baseHours = timeParts[0] || now.getHours();
    baseMinutes = timeParts[1] || now.getMinutes();
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
