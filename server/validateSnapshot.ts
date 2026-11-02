import { UserSnapshot } from './types';
import { UserSettings } from '../src/types';
import {
  parseAndValidateBackup,
  getDateStringInTimezone,
  getIanaTimezone,
} from '../src/utils/domainCalculations';

export interface ValidationSnapshotResult {
  isValid: boolean;
  error?: string;
  sanitizedSnapshot?: UserSnapshot;
}

const DEFAULT_SETTINGS: UserSettings = {
  name: 'Foydalanuvchi',
  username: '',
  timezone: 'Asia/Tashkent',
  morningTime: '08:00',
  eveningTime: '21:00',
  reminderSound: true,
  aiEnabled: true,
};

/**
 * Validates a domain snapshot against all business rules:
 * - Types and IDs of tasks, habits, goals, expenses, activities, and settings
 * - Cross-entity foreign key integrity (habitId, taskId, goalId)
 * - Two-way activity contributions consistency with habit day records
 * - Realistic calendar dates and future activity restrictions according to the user's timezone
 */
export function validateDomainSnapshot(rawSnapshot: any): ValidationSnapshotResult {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') {
    return {
      isValid: false,
      error: 'Snapshot obyekti (JSON) kiritilishi shart.',
    };
  }

  // Determine user timezone from snapshot settings if available
  const rawTz = rawSnapshot.settings?.timezone;
  const userTimezone = getIanaTimezone(typeof rawTz === 'string' ? rawTz : 'Asia/Tashkent');
  const todayStr = getDateStringInTimezone(new Date(), userTimezone);

  const jsonStr = typeof rawSnapshot === 'string' ? rawSnapshot : JSON.stringify(rawSnapshot);

  // Validate tasks, habits, goals, expenses, activities, settings using domain validation
  const validation = parseAndValidateBackup(jsonStr, {
    todayStr,
    currentTasks: [],
    currentHabits: [],
    currentGoals: [],
    currentExpenses: [],
    currentActivities: [],
    currentSettings: DEFAULT_SETTINGS,
  });

  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error || 'Snapshot ma‘lumotlar yaxlitligi tekshiruvidan o‘tmadi.',
    };
  }

  const sanitized: UserSnapshot = {
    tasks: validation.candidateData.tasks || [],
    habits: validation.candidateData.habits || [],
    goals: validation.candidateData.goals || [],
    expenses: validation.candidateData.expenses || [],
    activities: validation.candidateData.activities || [],
    settings: validation.candidateData.settings
      ? { ...DEFAULT_SETTINGS, ...validation.candidateData.settings }
      : undefined,
  };

  return {
    isValid: true,
    sanitizedSnapshot: sanitized,
  };
}
