import { Task, Habit, Goal, Expense, Activity, UserSettings } from '../src/types';

export interface TelegramUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isDemo?: boolean;
}

export interface UserSnapshot {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  expenses: Expense[];
  activities: Activity[];
  settings?: UserSettings;
}

export interface UserSnapshotRecord {
  userId: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  schemaVersion: number;
  revision: number;
  lastOperationId?: string;
  snapshot: UserSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSnapshotInput {
  expectedRevision: number;
  operationId: string;
  snapshot: UserSnapshot;
  schemaVersion?: number;
  username?: string;
  firstName?: string;
}

export type SaveSnapshotResult =
  | {
      status: 'saved';
      record: UserSnapshotRecord;
      isIdempotentReplay?: false;
    }
  | {
      status: 'idempotent_replay';
      record: UserSnapshotRecord;
      isIdempotentReplay: true;
    }
  | {
      status: 'conflict';
      currentRevision: number;
      serverRecord: UserSnapshotRecord | null;
    }
  | {
      status: 'error';
      error: string;
    };

export interface IUserStateRepository {
  get(userId: string): Promise<UserSnapshotRecord | null>;
  save(userId: string, input: SaveSnapshotInput): Promise<SaveSnapshotResult>;
  isLiveDatabase(): boolean;
}
