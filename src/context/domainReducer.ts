import { Habit, Goal, GoalInternalHabit, GoalProgressLog } from '../types';
import {
  applyHabitQuantityChange,
  applyHabitToggle,
  calculateHabitStreakAndStats,
  calculateInternalHabitStreak,
} from '../utils/domainCalculations';

export interface DomainState {
  habits: Habit[];
  goals: Goal[];
}

export type DomainAction =
  | {
      type: 'LOG_HABIT_QUANTITY';
      habitId: string;
      amount: number;
      dateStr: string;
      timestamp: string;
    }
  | {
      type: 'TOGGLE_HABIT_TODAY';
      habitId: string;
      dateStr: string;
      timestamp: string;
    }
  | {
      type: 'SET_HABITS';
      habits: Habit[] | ((prev: Habit[]) => Habit[]);
    }
  | {
      type: 'ADD_HABIT';
      habit: Habit;
    }
  | {
      type: 'UPDATE_HABIT';
      id: string;
      updates: Partial<Habit>;
      dateStr: string;
    }
  | {
      type: 'DELETE_HABIT';
      id: string;
      permanent: boolean;
    }
  | {
      type: 'RESTORE_HABIT';
      id: string;
    }
  | {
      type: 'SET_GOALS';
      goals: Goal[] | ((prev: Goal[]) => Goal[]);
    }
  | {
      type: 'ADD_GOAL';
      goal: Goal;
    }
  | {
      type: 'UPDATE_GOAL';
      id: string;
      updates: Partial<Goal>;
    }
  | {
      type: 'UPDATE_GOAL_PROGRESS';
      id: string;
      deltaAmount: number;
    }
  | {
      type: 'LOG_GOAL_PROGRESS';
      goalId: string;
      amount: number;
      date: string;
      time: string;
      logId: string;
      note?: string;
    }
  | {
      type: 'DELETE_GOAL_PROGRESS_LOG';
      goalId: string;
      logId: string;
    }
  | {
      type: 'ADD_GOAL_INTERNAL_HABIT';
      goalId: string;
      internalHabit: GoalInternalHabit;
    }
  | {
      type: 'TOGGLE_GOAL_INTERNAL_HABIT';
      goalId: string;
      habitId: string;
      dateStr: string;
      timestamp: string;
    }
  | {
      type: 'DELETE_GOAL_INTERNAL_HABIT';
      goalId: string;
      habitId: string;
    }
  | {
      type: 'DELETE_GOAL';
      id: string;
      permanent: boolean;
    }
  | {
      type: 'RESTORE_GOAL';
      id: string;
    }
  | {
      type: 'REFRESH_HABITS_DAILY_STATUS';
      dateStr: string;
    }
  | {
      type: 'RESET_DOMAIN';
      habits: Habit[];
      goals: Goal[];
    };

/**
 * Normalizes a habit's daily status and streak for a given reference date
 */
export function normalizeHabitForDate(habit: Habit, dateStr: string): Habit {
  const history = habit.history || {};
  const stats = calculateHabitStreakAndStats(
    history,
    habit.frequency,
    habit.daysOfWeek,
    habit.targetDaysPerWeek,
    dateStr,
    habit.bestStreak || 0
  );
  return {
    ...habit,
    currentQuantityToday: history[dateStr]?.quantity ?? 0,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    weeklyCompletions: stats.weeklyCompletions,
  };
}

/**
 * Normalizes internal habits within a goal for a given reference date
 */
export function normalizeGoalInternalHabitsForDate(goal: Goal, dateStr: string): Goal {
  if (!goal.internalHabits || goal.internalHabits.length === 0) {
    return goal;
  }
  return {
    ...goal,
    internalHabits: goal.internalHabits.map(ih => {
      const history = ih.history || {};
      const completedToday = !!history[dateStr]?.completed;
      const stats = calculateInternalHabitStreak(history, dateStr, ih.bestStreak || 0);
      return {
        ...ih,
        completedToday,
        history,
        streak: stats.streak,
        bestStreak: stats.bestStreak,
      };
    }),
  };
}

/**
 * Pure domain reducer for habits and goals
 */
export function domainReducer(state: DomainState, action: DomainAction): DomainState {
  switch (action.type) {
    case 'LOG_HABIT_QUANTITY': {
      const targetHabit = state.habits.find(h => h.id === action.habitId);
      if (!targetHabit) return state;

      const linkedGoal = targetHabit.linkedGoalId
        ? state.goals.find(g => g.id === targetHabit.linkedGoalId)
        : undefined;

      const { updatedHabit, updatedGoal } = applyHabitQuantityChange(
        targetHabit,
        linkedGoal,
        action.amount,
        action.dateStr,
        action.timestamp
      );

      return {
        ...state,
        habits: state.habits.map(h => (h.id === action.habitId ? updatedHabit : h)),
        goals: updatedGoal
          ? state.goals.map(g => (g.id === updatedGoal.id ? updatedGoal : g))
          : state.goals,
      };
    }

    case 'TOGGLE_HABIT_TODAY': {
      const targetHabit = state.habits.find(h => h.id === action.habitId);
      if (!targetHabit) return state;

      const linkedGoal = targetHabit.linkedGoalId
        ? state.goals.find(g => g.id === targetHabit.linkedGoalId)
        : undefined;

      const { updatedHabit, updatedGoal } = applyHabitToggle(
        targetHabit,
        linkedGoal,
        action.dateStr,
        action.timestamp
      );

      return {
        ...state,
        habits: state.habits.map(h => (h.id === action.habitId ? updatedHabit : h)),
        goals: updatedGoal
          ? state.goals.map(g => (g.id === updatedGoal.id ? updatedGoal : g))
          : state.goals,
      };
    }

    case 'SET_HABITS': {
      const nextHabits = typeof action.habits === 'function' ? action.habits(state.habits) : action.habits;
      return { ...state, habits: nextHabits };
    }

    case 'ADD_HABIT': {
      return {
        ...state,
        habits: [action.habit, ...state.habits],
      };
    }

    case 'UPDATE_HABIT': {
      return {
        ...state,
        habits: state.habits.map(h => {
          if (h.id === action.id) {
            const merged = { ...h, ...action.updates };
            return normalizeHabitForDate(merged, action.dateStr);
          }
          return h;
        }),
      };
    }

    case 'DELETE_HABIT': {
      return {
        ...state,
        habits: action.permanent
          ? state.habits.filter(h => h.id !== action.id)
          : state.habits.map(h => (h.id === action.id ? { ...h, isArchived: true } : h)),
      };
    }

    case 'RESTORE_HABIT': {
      return {
        ...state,
        habits: state.habits.map(h => (h.id === action.id ? { ...h, isArchived: false } : h)),
      };
    }

    case 'SET_GOALS': {
      const nextGoals = typeof action.goals === 'function' ? action.goals(state.goals) : action.goals;
      return { ...state, goals: nextGoals };
    }

    case 'ADD_GOAL': {
      return {
        ...state,
        goals: [action.goal, ...state.goals],
      };
    }

    case 'UPDATE_GOAL': {
      return {
        ...state,
        goals: state.goals.map(g => (g.id === action.id ? { ...g, ...action.updates } : g)),
      };
    }

    case 'UPDATE_GOAL_PROGRESS': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.id) {
            const isDecrease = g.goalType === 'decrease';
            const newVal = isDecrease
              ? Math.max(0, g.currentValue - action.deltaAmount)
              : Math.max(0, g.currentValue + action.deltaAmount);
            const achieved = isDecrease ? newVal <= g.targetValue : newVal >= g.targetValue;
            return {
              ...g,
              currentValue: newVal,
              status: achieved ? 'achieved' : 'active',
            };
          }
          return g;
        }),
      };
    }

    case 'LOG_GOAL_PROGRESS': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.goalId) {
            const isDecrease = g.goalType === 'decrease';
            const newVal = isDecrease
              ? Math.max(0, g.currentValue - action.amount)
              : Math.max(0, g.currentValue + action.amount);

            const achieved = isDecrease ? newVal <= g.targetValue : newVal >= g.targetValue;
            const remaining = isDecrease
              ? Math.max(0, newVal - g.targetValue)
              : Math.max(0, g.targetValue - newVal);

            const newLog: GoalProgressLog = {
              id: action.logId,
              date: action.date,
              time: action.time,
              amount: action.amount,
              note: action.note || undefined,
              resultingCurrent: newVal,
              resultingRemaining: remaining,
            };

            return {
              ...g,
              currentValue: newVal,
              status: achieved ? 'achieved' : 'active',
              progressLogs: [newLog, ...(g.progressLogs || [])],
            };
          }
          return g;
        }),
      };
    }

    case 'DELETE_GOAL_PROGRESS_LOG': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.goalId && g.progressLogs) {
            const targetLog = g.progressLogs.find(l => l.id === action.logId);
            if (!targetLog) return g;

            const isDecrease = g.goalType === 'decrease';
            const revertedVal = isDecrease
              ? g.currentValue + targetLog.amount
              : Math.max(0, g.currentValue - targetLog.amount);

            const achieved = isDecrease ? revertedVal <= g.targetValue : revertedVal >= g.targetValue;

            return {
              ...g,
              currentValue: revertedVal,
              status: achieved ? 'achieved' : 'active',
              progressLogs: g.progressLogs.filter(l => l.id !== action.logId),
            };
          }
          return g;
        }),
      };
    }

    case 'ADD_GOAL_INTERNAL_HABIT': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.goalId) {
            return {
              ...g,
              internalHabits: [...(g.internalHabits || []), action.internalHabit],
            };
          }
          return g;
        }),
      };
    }

    case 'TOGGLE_GOAL_INTERNAL_HABIT': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.goalId && g.internalHabits) {
            return {
              ...g,
              internalHabits: g.internalHabits.map(h => {
                if (h.id === action.habitId) {
                  const history = h.history || {};
                  const wasDone = !!history[action.dateStr]?.completed;
                  const willBeDone = !wasDone;
                  const updatedHistory = {
                    ...history,
                    [action.dateStr]: {
                      completed: willBeDone,
                      timestamp: action.timestamp,
                    },
                  };
                  const stats = calculateInternalHabitStreak(
                    updatedHistory,
                    action.dateStr,
                    h.bestStreak || 0
                  );
                  return {
                    ...h,
                    completedToday: willBeDone,
                    history: updatedHistory,
                    streak: stats.streak,
                    bestStreak: stats.bestStreak,
                  };
                }
                return h;
              }),
            };
          }
          return g;
        }),
      };
    }

    case 'DELETE_GOAL_INTERNAL_HABIT': {
      return {
        ...state,
        goals: state.goals.map(g => {
          if (g.id === action.goalId && g.internalHabits) {
            return {
              ...g,
              internalHabits: g.internalHabits.filter(h => h.id !== action.habitId),
            };
          }
          return g;
        }),
      };
    }

    case 'DELETE_GOAL': {
      return {
        ...state,
        goals: action.permanent
          ? state.goals.filter(g => g.id !== action.id)
          : state.goals.map(g => (g.id === action.id ? { ...g, isArchived: true } : g)),
      };
    }

    case 'RESTORE_GOAL': {
      return {
        ...state,
        goals: state.goals.map(g => (g.id === action.id ? { ...g, isArchived: false } : g)),
      };
    }

    case 'REFRESH_HABITS_DAILY_STATUS': {
      return {
        ...state,
        habits: state.habits.map(h => normalizeHabitForDate(h, action.dateStr)),
        goals: state.goals.map(g => normalizeGoalInternalHabitsForDate(g, action.dateStr)),
      };
    }

    case 'RESET_DOMAIN': {
      return {
        habits: action.habits,
        goals: action.goals,
      };
    }

    default:
      return state;
  }
}
