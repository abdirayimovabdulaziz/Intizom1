export type TaskCategory = 'vazifa' | 'uchrashuv';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'postponed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  reminderTime?: string;
  status: TaskStatus;
  completedAt?: string;
  priority: TaskPriority;
  notes?: string;
  source: 'bot' | 'miniapp';
  postponedUntil?: string;
  isArchived?: boolean;
}

export type HabitFrequency = 'daily' | 'weekly_target' | 'specific_days';
export type HabitType = 'general' | 'supplement_health';

export interface Habit {
  id: string;
  title: string;
  category: 'odat';
  habitType?: HabitType;
  dosage?: string; // e.g. "5 gram", "1 stakan", "2 kapsula"
  timeSlot?: string; // e.g. "Ertalab", "Mashg'ulotdan oldin", "Kechqurun"
  frequency: HabitFrequency;
  targetDaysPerWeek?: number; // e.g. 3 for "Haftada 3 marta"
  daysOfWeek: number[]; // 1=Mon (Du), 2=Tue (Se), 3=Wed (Ch), 4=Thu (Pa), 5=Fri (Ju), 6=Sat (Sh), 7=Sun (Ya)
  hasQuantity: boolean;
  targetQuantity?: number;
  unit?: string; // e.g., 'marta', 'sahifa', 'daqiqa', 'litr', 'gram'
  streak: number;
  bestStreak: number;
  currentQuantityToday?: number;
  history: Record<string, { completed: boolean; quantity?: number; timestamp?: string }>;
  linkedGoalId?: string;
  notes?: string;
  isArchived?: boolean;
}

export type ExpenseCategory =
  | 'oziq_ovqat'
  | 'transport'
  | 'salomatlik'
  | 'sport'
  | 'talim'
  | 'shaxsiy'
  | 'boshqa';

export type Currency = 'UZS' | 'USD';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency?: Currency; // 'UZS' | 'USD', default 'UZS'
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
  source: 'bot' | 'miniapp';
  isArchived?: boolean;
}

export interface GoalInternalHabit {
  id: string;
  title: string;
  targetFrequency: string; // e.g. "Haftada 3 kun", "Har kuni", "Nahorga"
  completedToday?: boolean;
  streak?: number;
}

export interface GoalProgressLog {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  amount: number;
  note?: string; // e.g. "O'tgan kunlar kitobidan 30 bet"
  resultingCurrent: number;
  resultingRemaining: number;
}

export interface Goal {
  id: string;
  title: string;
  category: 'maqsad';
  deadline: string; // YYYY-MM-DD
  targetValue: number;
  currentValue: number;
  startValue?: number; // e.g. 90 kg
  goalType?: 'reach' | 'decrease'; // reach: 0 -> 300 bet, decrease: 90 kg -> 85 kg
  unit: string;
  linkedHabitIds: string[];
  internalHabits?: GoalInternalHabit[];
  progressLogs?: GoalProgressLog[];
  status: 'active' | 'achieved' | 'paused';
  notes?: string;
  isArchived?: boolean;
}

export interface ParsedItem {
  category: 'vazifa' | 'odat' | 'maqsad' | 'uchrashuv' | 'harajat' | 'qabul' | 'noaniq';
  title: string;
  date?: string | null;
  time?: string | null;
  quantity?: number | null;
  unit?: string | null;
  amount?: number | null;
  currency?: Currency | null;
  expenseCategory?: ExpenseCategory | null;
  dosage?: string | null;
  timeSlot?: string | null;
  daysOfWeek?: (number | string)[] | null;
  confidence: number;
  explanationUz: string;
  source: 'gemini-ai' | 'local-rules';
}

export interface BotInlineAction {
  id: string;
  label: string;
  action: 'confirm_create' | 'edit_time' | 'cancel_prompt' | 'open_miniapp' | 'mark_done' | 'postpone_15' | 'clarify_type';
  payload?: any;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  parsedItem?: ParsedItem;
  actions?: BotInlineAction[];
  isReminder?: boolean;
}

export interface UserSettings {
  name: string;
  username: string;
  timezone: string;
  morningTime: string;
  eveningTime: string;
  reminderSound: boolean;
  aiEnabled: boolean;
  monthlyExpenseBudget?: number;
}

export type MiniAppTab =
  | 'bosh_sahifa'
  | 'vazifalar'
  | 'odatlar'
  | 'harajatlar'
  | 'maqsadlar'
  | 'kalendar'
  | 'sozlamalar';

export type AppDisplayMode = 'split' | 'miniapp' | 'bot';
