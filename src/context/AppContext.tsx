import React, { createContext, useContext, useEffect, useState, useReducer } from 'react';
import {
  Task,
  Habit,
  Goal,
  Expense,
  ChatMessage,
  UserSettings,
  MiniAppTab,
  AppDisplayMode,
  ParsedItem,
  BotInlineAction,
  GoalInternalHabit,
  GoalProgressLog,
} from '../types';
import {
  formatDateYMD,
  formatUzbekDateLabel,
  formatSom,
  formatMoney,
  parseUzbekIntent,
  buildHabitCreatePayload,
  buildExpenseCreatePayload,
  buildTaskCreatePayload,
  processEntityCreationFromParsed,
} from '../utils/uzbekNlp';
import { triggerHaptic } from '../utils/telegram';
import {
  calculatePostponedTask,
  calculateHabitIntakeDecision,
  generateEntityId,
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
  getIanaTimezone,
} from '../utils/domainCalculations';
import {
  domainReducer,
  DomainState,
  DomainAction,
  normalizeHabitForDate,
  normalizeGoalInternalHabitsForDate,
} from './domainReducer';

interface AppContextType {
  todayStr: string;
  timezone: string;
  todayDayOfWeek: number;
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  expenses: Expense[];
  messages: ChatMessage[];
  settings: UserSettings;
  displayMode: AppDisplayMode;
  activeTab: MiniAppTab;
  activeNotification: { title: string; body: string; taskId?: string } | null;
  isAiProcessing: boolean;
  setDisplayMode: (mode: AppDisplayMode) => void;
  setActiveTab: (tab: MiniAppTab) => void;
  addTask: (task: Omit<Task, 'id'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTaskComplete: (id: string) => void;
  postponeTask: (id: string, minutesOrDate: number | string) => void;
  deleteTask: (id: string, permanent?: boolean) => void;
  restoreTask: (id: string) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'streak' | 'bestStreak' | 'history' | 'currentQuantityToday'>) => Habit;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  toggleHabitToday: (id: string) => void;
  markHabitCompletedToday: (id: string) => void;
  logHabitQuantity: (id: string, amount: number) => void;
  deleteHabit: (id: string, permanent?: boolean) => void;
  restoreHabit: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'status'>) => Goal;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  updateGoalProgress: (id: string, deltaAmount: number) => void;
  logGoalProgress: (goalId: string, amount: number, note?: string) => void;
  addGoalInternalHabit: (goalId: string, title: string, targetFrequency: string) => void;
  toggleGoalInternalHabit: (goalId: string, habitId: string) => void;
  deleteGoalInternalHabit: (goalId: string, habitId: string) => void;
  deleteGoalProgressLog: (goalId: string, logId: string) => void;
  deleteGoal: (id: string, permanent?: boolean) => void;
  restoreGoal: (id: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  exportAllDataAsJson: () => void;
  importDataFromJson: (jsonStr: string) => { success: boolean; message: string };
  sendBotMessage: (text: string) => Promise<void>;
  handleBotAction: (messageId: string, action: BotInlineAction) => void;
  triggerSimulatedReminder: (customTitle?: string) => void;
  dismissNotification: () => void;
  runMorningKickoff: () => void;
  runEveningReflection: () => void;
  generateWeeklyReview: () => Promise<string>;
  resetToDemoData: () => void;
  clearAllData: () => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_TASKS = 'kunlik_yordamchi_tasks_clean_v1';
const STORAGE_KEY_HABITS = 'kunlik_yordamchi_habits_clean_v1';
const STORAGE_KEY_GOALS = 'kunlik_yordamchi_goals_clean_v1';
const STORAGE_KEY_EXPENSES = 'kunlik_yordamchi_expenses_clean_v1';
const STORAGE_KEY_MSGS = 'kunlik_yordamchi_messages_clean_v1';
const STORAGE_KEY_SETTINGS = 'kunlik_yordamchi_settings_clean_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const defaultTasks: Task[] = [];
  const defaultHabits: Habit[] = [];
  const defaultGoals: Goal[] = [];
  const defaultExpenses: Expense[] = [];

  const defaultMessages: ChatMessage[] = [
    {
      id: 'msg-init-clean',
      sender: 'bot',
      text: `👋 **Assalomu alaykum, Abdulaziz!**\n\nMen sizning shaxsiy **Kunlik Yordamchingizman**.\nBarcha namunaviy ma'lumotlar tozalandi va tizim haqiqiy foydalanishga to'liq shay holatga keltirildi.\n\nSiz menga to'g'ridan-to'g'ri o'zbek tilida yozishingiz mumkin:\n• \`harajat: 45000 tushlik\`\n• \`vazifa: ertaga soat 15:30 hisobot yuborish\`\n• \`odat: har kuni 5g kreatin\`\n• \`maqsad: 300 bet kitob o'qish\`\n\nYoki pastdagi "Mini App'ni ochish" tugmasini bosing! 🚀`,
      timestamp: '09:00',
      actions: [
        {
          id: 'btn-open-app',
          label: "📱 Mini App'ni ochish",
          action: 'open_miniapp',
          variant: 'primary',
        },
      ],
    },
  ];

  const defaultSettings: UserSettings = {
    name: 'Abdulaziz',
    username: 'abdulaziz_dev',
    timezone: 'Asia/Tashkent (UTC+5)',
    morningTime: '08:00',
    eveningTime: '21:00',
    reminderSound: true,
    aiEnabled: true,
    monthlyExpenseBudget: 3500000,
  };

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [activeTodayStr, setActiveTodayStr] = useState(() =>
    getDateStringInTimezone(new Date(), defaultSettings.timezone)
  );

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : defaultTasks;
    } catch {
      return defaultTasks;
    }
  });

  const [domainState, domainDispatch] = useReducer(
    domainReducer,
    undefined,
    (): DomainState => {
      const today = getDateStringInTimezone(new Date(), defaultSettings.timezone);

      const savedHabits: Habit[] = (() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY_HABITS);
          if (saved) {
            const parsed: Habit[] = JSON.parse(saved);
            return parsed.map(h => normalizeHabitForDate(h, today));
          }
          return defaultHabits;
        } catch {
          return defaultHabits;
        }
      })();

      const savedGoals: Goal[] = (() => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY_GOALS);
          if (saved) {
            const parsed: Goal[] = JSON.parse(saved);
            return parsed.map(g => normalizeGoalInternalHabitsForDate(g, today));
          }
          return defaultGoals;
        } catch {
          return defaultGoals;
        }
      })();

      return { habits: savedHabits, goals: savedGoals };
    }
  );

  const habits = domainState.habits;
  const goals = domainState.goals;

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPENSES);
      return saved ? JSON.parse(saved) : defaultExpenses;
    } catch {
      return defaultExpenses;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MSGS);
      return saved ? JSON.parse(saved) : defaultMessages;
    } catch {
      return defaultMessages;
    }
  });

  const [displayMode, setDisplayMode] = useState<AppDisplayMode>('split');
  const [activeTab, setActiveTab] = useState<MiniAppTab>('bosh_sahifa');
  const [activeNotification, setActiveNotification] = useState<{ title: string; body: string; taskId?: string } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Adjust active date when day rolls over or window focus / visibility changes
  useEffect(() => {
    const checkAndRefreshDate = () => {
      const currentToday = getDateStringInTimezone(new Date(), settings.timezone);
      setActiveTodayStr(prev => {
        if (prev !== currentToday) {
          domainDispatch({ type: 'REFRESH_HABITS_DAILY_STATUS', dateStr: currentToday });
          return currentToday;
        }
        return prev;
      });
    };

    checkAndRefreshDate();

    window.addEventListener('focus', checkAndRefreshDate);
    document.addEventListener('visibilitychange', checkAndRefreshDate);
    const intervalId = setInterval(checkAndRefreshDate, 30000);

    return () => {
      window.removeEventListener('focus', checkAndRefreshDate);
      document.removeEventListener('visibilitychange', checkAndRefreshDate);
      clearInterval(intervalId);
    };
  }, [settings.timezone]);

  // Adjust displayMode on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && displayMode === 'split') {
        setDisplayMode('miniapp');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMode]);

  const addTask = (newTaskData: Omit<Task, 'id'>): Task => {
    const task: Task = {
      ...newTaskData,
      id: generateEntityId('task'),
    };
    setTasks(prev => [task, ...prev]);
    triggerHaptic('light');
    return task;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  };

  const toggleTaskComplete = (id: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const isDone = t.status === 'completed';
          triggerHaptic(isDone ? 'selection' : 'success');
          return {
            ...t,
            status: isDone ? 'pending' : 'completed',
            completedAt: isDone ? undefined : new Date().toISOString(),
          };
        }
        return t;
      })
    );
  };

  const postponeTask = (id: string, minutesOrDate: number | string) => {
    const targetTask = tasks.find(t => t.id === id);
    if (!targetTask) return;

    const now = new Date();
    const updates = calculatePostponedTask(targetTask, minutesOrDate, now, settings.timezone);
    if (!updates) {
      return;
    }

    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    triggerHaptic('light');
  };

  const deleteTask = (id: string, permanent: boolean = false) => {
    triggerHaptic('warning');
    if (permanent) {
      setTasks(prev => prev.filter(t => t.id !== id));
    } else {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, isArchived: true } : t)));
    }
  };

  const restoreTask = (id: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, isArchived: false } : t)));
    triggerHaptic('light');
  };

  const addHabit = (newHabitData: Omit<Habit, 'id' | 'streak' | 'bestStreak' | 'history' | 'currentQuantityToday'>): Habit => {
    const habit: Habit = {
      ...newHabitData,
      id: generateEntityId('habit'),
      streak: 0,
      bestStreak: 0,
      currentQuantityToday: 0,
      history: {},
    };
    domainDispatch({ type: 'ADD_HABIT', habit });
    triggerHaptic('light');
    return habit;
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    domainDispatch({ type: 'UPDATE_HABIT', id, updates, dateStr: activeTodayStr });
    triggerHaptic('light');
  };

  const toggleHabitToday = (id: string) => {
    const targetHabit = domainState.habits.find(h => h.id === id);
    const currentlyDone = targetHabit?.history[activeTodayStr]?.completed;
    const timestamp = new Date().toISOString();

    domainDispatch({
      type: 'TOGGLE_HABIT_TODAY',
      habitId: id,
      dateStr: activeTodayStr,
      timestamp,
    });

    triggerHaptic(currentlyDone ? 'selection' : 'success');
  };

  const markHabitCompletedToday = (id: string) => {
    const timestamp = new Date().toISOString();
    domainDispatch({
      type: 'SET_HABIT_COMPLETION_TODAY',
      habitId: id,
      completed: true,
      dateStr: activeTodayStr,
      timestamp,
    });
    triggerHaptic('success');
  };

  const logHabitQuantity = (id: string, amount: number) => {
    const timestamp = new Date().toISOString();

    domainDispatch({
      type: 'LOG_HABIT_QUANTITY',
      habitId: id,
      amount,
      dateStr: activeTodayStr,
      timestamp,
    });

    triggerHaptic(amount > 0 ? 'selection' : 'light');
  };

  const deleteHabit = (id: string, permanent: boolean = false) => {
    domainDispatch({ type: 'DELETE_HABIT', id, permanent });
    triggerHaptic('warning');
  };

  const restoreHabit = (id: string) => {
    domainDispatch({ type: 'RESTORE_HABIT', id });
    triggerHaptic('light');
  };

  const addGoal = (newGoalData: Omit<Goal, 'id' | 'status'>): Goal => {
    const goal: Goal = {
      ...newGoalData,
      id: generateEntityId('goal'),
      status: 'active',
    };
    domainDispatch({ type: 'ADD_GOAL', goal });
    triggerHaptic('light');
    return goal;
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    domainDispatch({ type: 'UPDATE_GOAL', id, updates });
    triggerHaptic('light');
  };

  const updateGoalProgress = (id: string, deltaAmount: number) => {
    domainDispatch({ type: 'UPDATE_GOAL_PROGRESS', id, deltaAmount });
    triggerHaptic('selection');
  };

  const deleteGoal = (id: string, permanent: boolean = false) => {
    domainDispatch({ type: 'DELETE_GOAL', id, permanent });
    triggerHaptic('warning');
  };

  const restoreGoal = (id: string) => {
    domainDispatch({ type: 'RESTORE_GOAL', id });
    triggerHaptic('light');
  };

  const logGoalProgress = (goalId: string, amount: number, note?: string) => {
    const timeStr = getTimeString();
    const logId = generateEntityId('log');
    domainDispatch({
      type: 'LOG_GOAL_PROGRESS',
      goalId,
      amount,
      date: activeTodayStr,
      time: timeStr,
      logId,
      note,
    });
    triggerHaptic('selection');
  };

  const deleteGoalProgressLog = (goalId: string, logId: string) => {
    domainDispatch({ type: 'DELETE_GOAL_PROGRESS_LOG', goalId, logId });
    triggerHaptic('light');
  };

  const addGoalInternalHabit = (goalId: string, title: string, targetFrequency: string) => {
    const newHabit: GoalInternalHabit = {
      id: generateEntityId('ghabit'),
      title,
      targetFrequency,
      completedToday: false,
      streak: 0,
      bestStreak: 0,
      history: {},
    };
    domainDispatch({ type: 'ADD_GOAL_INTERNAL_HABIT', goalId, internalHabit: newHabit });
    triggerHaptic('light');
  };

  const toggleGoalInternalHabit = (goalId: string, habitId: string) => {
    domainDispatch({
      type: 'TOGGLE_GOAL_INTERNAL_HABIT',
      goalId,
      habitId,
      dateStr: activeTodayStr,
      timestamp: new Date().toISOString(),
    });
    triggerHaptic('selection');
  };

  const deleteGoalInternalHabit = (goalId: string, habitId: string) => {
    domainDispatch({ type: 'DELETE_GOAL_INTERNAL_HABIT', goalId, habitId });
    triggerHaptic('light');
  };

  const exportAllDataAsJson = () => {
    const backupData = {
      appName: 'Kunlik Yordamchi',
      exportDate: new Date().toISOString(),
      tasks,
      habits,
      goals,
      expenses,
      settings,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kunlik-yordamchi-backup-${formatDateYMD(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Expenses methods
  const addExpense = (newExpenseData: Omit<Expense, 'id'>): Expense => {
    const expense: Expense = {
      ...newExpenseData,
      id: generateEntityId('exp'),
    };
    setExpenses(prev => [expense, ...prev]);
    triggerHaptic('light');
    return expense;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)));
    triggerHaptic('light');
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    triggerHaptic('warning');
  };

  const importDataFromJson = (jsonStr: string): { success: boolean; message: string } => {
    try {
      const data = JSON.parse(jsonStr);
      let loadedCount = 0;
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        loadedCount += data.tasks.length;
      }
      const importedHabits = Array.isArray(data.habits) ? data.habits : habits;
      const importedGoals = Array.isArray(data.goals) ? data.goals : goals;
      if (Array.isArray(data.habits)) {
        loadedCount += data.habits.length;
      }
      if (Array.isArray(data.goals)) {
        loadedCount += data.goals.length;
      }
      domainDispatch({
        type: 'RESET_DOMAIN',
        habits: importedHabits,
        goals: importedGoals,
      });

      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        loadedCount += data.expenses.length;
      }
      if (data.settings && typeof data.settings === 'object') {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
      triggerHaptic('success');
      return {
        success: true,
        message: `Muvaffaqiyatli tiklandi! Jami ${loadedCount} ta yozuv yuklandi.`,
      };
    } catch {
      triggerHaptic('error');
      return {
        success: false,
        message: "JSON fayli formati noto'g'ri yoki buzilgan.",
      };
    }
  };

  const getTimeString = () => {
    const iana = getIanaTimezone(settings.timezone);
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: iana,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  };

  // Bot Chat Flow and Uzbek NLP handling
  const sendBotMessage = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const timeStr = getTimeString();
    const userMsg: ChatMessage = {
      id: generateEntityId('msg-user'),
      sender: 'user',
      text: trimmed,
      timestamp: timeStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAiProcessing(true);

    try {
      // 1. Check for command prefixes: /start, /bugun, /reja, /sarhisob, /hisobot, /harajat, /salomatlik, /yordam
      if (trimmed.startsWith('/')) {
        handleCommand(trimmed, timeStr);
        setIsAiProcessing(false);
        return;
      }

      // 2. Parse text with Gemini AI or local rule fallback
      const parsed: ParsedItem = await parseUzbekIntent(trimmed, {
        referenceDate: new Date(),
        timezone: settings.timezone,
        aiEnabled: settings.aiEnabled,
      });

      // Handle Blocked Income
      if (parsed.isIncomeBlocked) {
        const botReply: ChatMessage = {
          id: generateEntityId('msg-bot'),
          sender: 'bot',
          text: `ℹ️ **Daromad hisobi:**\nHozircha ilovada faqat xarajatlar tahlili qo'llab-quvvatlanadi. Daromadlarni kiritish keyingi bosqichlarda qo'shiladi. Ushbu yozuv xarajat sifatida kiritilmadi.`,
          timestamp: getTimeString(),
        };
        setMessages(prev => [...prev, botReply]);
        setIsAiProcessing(false);
        return;
      }

      // Handle Blocked Interval Schedule ("kunora")
      if (parsed.isIntervalBlocked) {
        const botReply: ChatMessage = {
          id: generateEntityId('msg-bot'),
          sender: 'bot',
          text: `⚠️ **Kunora takrorlanish jadvali:**\n"Kunora" jadvali hozircha avtomatik qo'llab-quvvatlanmaydi. Iltimos, quyidagi jadvallardan birini tanlang:\n• Har kuni (\`har kuni ...\`)\n• Haftaning ma'lum kunlari (\`har dushanba va juma ...\`)\n• Haftasiga ma'lum kun (\`haftasiga 3 kun ...\`)`,
          timestamp: getTimeString(),
        };
        setMessages(prev => [...prev, botReply]);
        setIsAiProcessing(false);
        return;
      }

      // Handle Blocked Multiple Actions in one message
      if (parsed.isMultipleActionsBlocked) {
        const botReply: ChatMessage = {
          id: generateEntityId('msg-bot'),
          sender: 'bot',
          text: `⚠️ **Bir nechta amal aniqlandi:**\nXatoliklarning oldini olish uchun, iltimos, har bir vazifa, xarajat yoki odatni alohida xabar sifatida yuboring.`,
          timestamp: getTimeString(),
        };
        setMessages(prev => [...prev, botReply]);
        setIsAiProcessing(false);
        return;
      }

      // Handle Explicit Clarification Request
      if (parsed.clarificationNeeded) {
        const botReply: ChatMessage = {
          id: generateEntityId('msg-bot'),
          sender: 'bot',
          text: `❓ **Aniqlashtirish zarur:**\n${parsed.clarificationNeeded}`,
          timestamp: getTimeString(),
        };
        setMessages(prev => [...prev, botReply]);
        setIsAiProcessing(false);
        return;
      }

      // Handle Ambiguous input
      if (parsed.category === 'noaniq') {
        const botReply: ChatMessage = {
          id: generateEntityId('msg-bot'),
          sender: 'bot',
          text: `🤔 Siz kiritgan yozuv: **"${parsed.title}"**\n\nIltimos, ushbu yozuv qaysi toifaga mansubligini tanlang:`,
          timestamp: getTimeString(),
          parsedItem: parsed,
          actions: [
            {
              id: 'clarify-vazifa',
              label: '📌 Vazifa',
              action: 'clarify_type',
              payload: { ...parsed, category: 'vazifa' },
              variant: 'primary',
            },
            {
              id: 'clarify-harajat',
              label: '💰 Xarajat',
              action: 'clarify_type',
              payload: { ...parsed, category: 'harajat' },
              variant: 'primary',
            },
            {
              id: 'clarify-qabul',
              label: '💊 Salomatlik / Qabul',
              action: 'clarify_type',
              payload: { ...parsed, category: 'qabul', habitType: 'supplement_health' },
              variant: 'secondary',
            },
            {
              id: 'clarify-odat',
              label: '🔁 Odat',
              action: 'clarify_type',
              payload: { ...parsed, category: 'odat', habitType: 'general' },
              variant: 'secondary',
            },
            {
              id: 'clarify-cancel',
              label: '❌ Bekor qilish',
              action: 'cancel_prompt',
              variant: 'danger',
            },
          ],
        };
        setMessages(prev => [...prev, botReply]);
        setIsAiProcessing(false);
        return;
      }

      // Format response according to category
      let responseText = '';
      const actions: BotInlineAction[] = [];

      // EXPENSE (HARAJAT)
      if (parsed.category === 'harajat') {
        const amountDisplay = parsed.amount ? formatMoney(parsed.amount, parsed.currency || 'UZS') : '0 so\'m';
        const categoryLabel = parsed.expenseCategory ? parsed.expenseCategory.replace('_', ' ') : 'shaxsiy';

        responseText = `💸 **Yangi Xarajat aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}\n💰 **Summa:** ${amountDisplay}\n🏷 **Toifa:** ${categoryLabel}\n📅 **Sana:** Bugun (${parsed.date || activeTodayStr})`;

        actions.push(
          {
            id: generateEntityId('confirm-exp'),
            label: '✅ Xarajatni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: generateEntityId('cancel'),
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      }
      // HEALTH / SUPPLEMENTS (QABUL - Kreatin, L-Arginin, Asalli suv)
      else if (parsed.category === 'qabul') {
        const dosageLabel = parsed.dosage || '1 qabul';
        const slotLabel = parsed.timeSlot || 'Ertalab / Kunlik';

        responseText = `💊 **Kunlik Qabul (Salomatlik):**\n\n📌 **Nomi:** ${parsed.title}\n⚖️ **Miqdor:** ${dosageLabel}\n⏰ **Tavsiya etilgan vaqt:** ${slotLabel}\n\nUshbu qabulni qanday qayd qilamiz?`;

        actions.push(
          {
            id: generateEntityId('mark-intake'),
            label: '✅ Bugun qabul qilindi',
            action: 'confirm_create',
            payload: { ...parsed, markDoneToday: true },
            variant: 'primary',
          },
          {
            id: generateEntityId('add-routine'),
            label: '🔁 Doimiy odatga qo\'shish',
            action: 'confirm_create',
            payload: { ...parsed, markDoneToday: false },
            variant: 'secondary',
          },
          {
            id: generateEntityId('cancel'),
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      }
      // TASKS & MEETINGS
      else if (parsed.category === 'vazifa' || parsed.category === 'uchrashuv') {
        const dateLabel = formatUzbekDateLabel(parsed.date || activeTodayStr, parsed.time);
        responseText = `✅ **${parsed.category === 'uchrashuv' ? 'Uchrashuv' : 'Vazifa'} aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}\n📅 **Sana:** ${dateLabel}\n⏰ **Vaqt:** ${parsed.time || 'Belgilanmagan (kun davomida)'}\n🌍 **Vaqt zonasi:** ${settings.timezone}`;

        actions.push(
          {
            id: generateEntityId('confirm'),
            label: '✅ Tasdiqlash va Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: generateEntityId('edit'),
            label: '✏️ Vaqtni o\'zgartirish',
            action: 'edit_time',
            payload: parsed,
            variant: 'secondary',
          },
          {
            id: generateEntityId('cancel'),
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      } else if (parsed.category === 'odat') {
        responseText = `🔁 **Yangi Odat aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}`;
        if (parsed.quantity && parsed.unit) {
          responseText += `\n🎯 **Miqdor rejasi:** ${parsed.quantity} ${parsed.unit}/kun`;
        }
        let freqLabel = 'Har kuni';
        if (parsed.frequency === 'weekly_target' && parsed.targetDaysPerWeek) {
          freqLabel = `Haftasiga ${parsed.targetDaysPerWeek} kun`;
        } else if (parsed.frequency === 'specific_days' && parsed.daysOfWeek && parsed.daysOfWeek.length > 0) {
          freqLabel = 'Haftaning tanlangan kunlari';
        }
        responseText += `\n📅 **Davriyligi:** ${freqLabel}`;

        actions.push(
          {
            id: generateEntityId('confirm'),
            label: '✅ Odatni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: generateEntityId('cancel'),
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      } else if (parsed.category === 'maqsad') {
        responseText = `🎯 **Yangi Maqsad aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}`;
        if (parsed.quantity) {
          responseText += `\n🎯 **Kutilayotgan natija:** ${parsed.quantity} ${parsed.unit || ''}`;
        }
        if (parsed.date) {
          responseText += `\n⏳ **Muddat:** ${parsed.date}`;
        }

        actions.push(
          {
            id: generateEntityId('confirm'),
            label: '✅ Maqsadni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: generateEntityId('cancel'),
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      }

      const botReply: ChatMessage = {
        id: generateEntityId('msg-bot'),
        sender: 'bot',
        text: responseText,
        timestamp: getTimeString(),
        parsedItem: parsed,
        actions,
      };

      setMessages(prev => [...prev, botReply]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('msg-err'),
          sender: 'bot',
          text: 'Kechirasiz, xabaringizni tahlil qilishda xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.',
          timestamp: getTimeString(),
        },
      ]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleCommand = (cmd: string, timeStr: string) => {
    const cleanCmd = cmd.toLowerCase().trim();

    if (cleanCmd === '/start') {
      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('cmd-start'),
          sender: 'bot',
          text: `Salom, ${settings.name}! 🚀\n\nMen sizning shaxsiy Telegram yordamchingizman.\n\nQuyidagi imkoniyatlardan foydalanishingiz mumkin:\n• **Xarajatlar:** \`harajat: 45000 tushlik\` yoki \`sarf: 120000 taksi\`\n• **Salomatlik & Qabullar:** \`5g kreatin\` yoki \`l-arginin\` yoki \`ertalab asalli suv\`\n• **Vazifalar:** \`vazifa: ertaga soat 15:30 hisobot yuborish\`\n• **Odatlar & Maqsadlar:** \`odat: har kuni 20 sahifa kitob\`\n• \`/harajat\` - Bugungi va oylik xarajatlar sarhisobi\n• \`/salomatlik\` - Kunlik qabullar holati\n• \`/bugun\` - Bugungi barcha rejalar`,
          timestamp: timeStr,
          actions: [
            {
              id: 'btn-open-app',
              label: '📱 Mini App\'ni ochish',
              action: 'open_miniapp',
              variant: 'primary',
            },
          ],
        },
      ]);
    } else if (cleanCmd === '/harajat' || cleanCmd === '/moliya') {
      const todayExpenses = expenses.filter(e => e.date === activeTodayStr);
      const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
      const monthPrefix = activeTodayStr.slice(0, 7);
      const monthTotal = expenses.filter(e => e.date.startsWith(monthPrefix)).reduce((sum, e) => sum + e.amount, 0);

      let text = `💰 **Moliyaviy Sarhisob:**\n\n`;
      text += `📅 **Bugungi xarajat:** ${formatSom(todayTotal)}\n`;
      text += `📊 **Ushbu oydagi jami xarajat:** ${formatSom(monthTotal)}\n\n`;

      if (todayExpenses.length > 0) {
        text += `📌 **Bugungi xarajatlar ro'yxati:**\n`;
        todayExpenses.forEach(e => {
          text += `• ${e.title}: ${formatSom(e.amount)}\n`;
        });
      } else {
        text += `Bugun hali xarajat kiritilmagan. \`harajat: 45000 tushlik\` deb yozishingiz mumkin!`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('cmd-exp'),
          sender: 'bot',
          text,
          timestamp: timeStr,
          actions: [
            {
              id: 'open-harajat-app',
              label: '📱 Xarajatlar bo\'limini ochish',
              action: 'open_miniapp',
              variant: 'primary',
            },
          ],
        },
      ]);
    } else if (cleanCmd === '/salomatlik' || cleanCmd === '/qabullar') {
      const supplementHabits = habits.filter(h => h.habitType === 'supplement_health');
      let text = `💊 **Bugungi Salomatlik & Qabullar:**\n\n`;

      if (supplementHabits.length === 0) {
        text += `Qabullar mavjud emas. Masalan, "5g kreatin", "l-arginin" yoki "ertalab asalli suv" deb yozishingiz mumkin.`;
      } else {
        supplementHabits.forEach(sh => {
          const isDone = sh.history[activeTodayStr]?.completed;
          const statusIcon = isDone ? '✅' : '⏳';
          text += `${statusIcon} **${sh.title}** (${sh.dosage || ''})\n   ⏰ ${sh.timeSlot || 'Kunlik'}\n`;
        });
      }

      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('cmd-salom'),
          sender: 'bot',
          text,
          timestamp: timeStr,
          actions: [
            {
              id: 'open-odat-app',
              label: '📱 Odatlar & Qabullarni ochish',
              action: 'open_miniapp',
              variant: 'primary',
            },
          ],
        },
      ]);
    } else if (cleanCmd === '/bugun') {
      const today = activeTodayStr;
      const todaysTasks = tasks.filter(t => t.date === today && t.status !== 'cancelled');
      const todaysHabits = habits;
      const todayExpenses = expenses.filter(e => e.date === today);
      const todayExpenseSum = todayExpenses.reduce((s, e) => s + e.amount, 0);

      let text = `📅 **Bugungi Rejalar (${formatUzbekDateLabel(today)}):**\n\n`;

      if (todaysTasks.length > 0) {
        text += `📌 **Vazifalar (${todaysTasks.length} ta):**\n`;
        todaysTasks.forEach(t => {
          const check = t.status === 'completed' ? '✅' : '⏳';
          const timeInfo = t.time ? `[${t.time}] ` : '';
          text += `${check} ${timeInfo}${t.title}\n`;
        });
        text += '\n';
      }

      if (todaysHabits.length > 0) {
        text += `🔁 **Odatlar & Qabullar (${todaysHabits.length} ta):**\n`;
        todaysHabits.forEach(h => {
          const rec = h.history[today];
          const check = rec?.completed ? '✅' : '⭕';
          text += `${check} ${h.title} (🔥 ${h.streak} kun)\n`;
        });
        text += '\n';
      }

      text += `💰 **Bugungi xarajat:** ${formatSom(todayExpenseSum)}\n`;

      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('cmd-bugun'),
          sender: 'bot',
          text,
          timestamp: timeStr,
          actions: [
            {
              id: 'open-app',
              label: '📱 Mini App orqali boshqarish',
              action: 'open_miniapp',
              variant: 'primary',
            },
          ],
        },
      ]);
    } else if (cleanCmd === '/reja') {
      runMorningKickoff();
    } else if (cleanCmd === '/sarhisob') {
      runEveningReflection();
    } else if (cleanCmd === '/hisobot') {
      generateWeeklyReview().then(summary => {
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('cmd-hisobot'),
            sender: 'bot',
            text: `📊 **Haftalik Tahlil va Maslahatlar:**\n\n${summary}`,
            timestamp: getTimeString(),
            actions: [
              {
                id: 'open-app',
                label: '📱 Mini App\'da ko\'rish',
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
      });
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('cmd-help'),
          sender: 'bot',
          text: `ℹ️ **Kunlik Yordamchi buyruqlari:**\n\n• \`/bugun\` - Bugungi ishlar ro'yxati\n• \`/harajat\` - Xarajatlar tahlili\n• \`/salomatlik\` - Kreatin, l-arginin, asalli suv qabullari\n• \`/reja\` - Ertalabki rejalashtirish\n• \`/sarhisob\` - Kechki hisobot\n\n**Misollar:**\n• \`harajat: 45000 tushlik\`\n• \`5g kreatin\`\n• \`l-arginin ichdim\`\n• \`vazifa: ertaga soat 15:30 hisobot yuborish\``,
          timestamp: timeStr,
          actions: [
            {
              id: 'open-app',
              label: '📱 Mini App\'ni ochish',
              action: 'open_miniapp',
              variant: 'primary',
            },
          ],
        },
      ]);
    }
  };

  const handleBotAction = (messageId: string, action: BotInlineAction) => {
    const timeStr = getTimeString();

    const executeQabulDecision = (
      pItem: ParsedItem & { markDoneToday?: boolean; targetHabitId?: string },
      habitPayload: any,
      isMarkDoneRequested: boolean
    ) => {
      const decision = calculateHabitIntakeDecision(
        habits,
        {
          title: pItem.title,
          targetHabitId: pItem.targetHabitId,
          markDoneToday: isMarkDoneRequested,
        },
        activeTodayStr
      );

      if (decision.action === 'disambiguation_needed') {
        const disambigActions: BotInlineAction[] = decision.candidates.map(candidate => ({
          id: generateEntityId('choose-habit'),
          label: `💊 ${candidate.title}`,
          action: 'confirm_create',
          payload: {
            ...pItem,
            category: 'qabul',
            habitType: 'supplement_health',
            targetHabitId: candidate.id,
            title: candidate.title,
            markDoneToday: isMarkDoneRequested,
          },
          variant: 'secondary',
        }));

        disambigActions.push({
          id: generateEntityId('cancel'),
          label: '❌ Bekor qilish',
          action: 'cancel_prompt',
          variant: 'danger',
        });

        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('msg-disambig'),
            sender: 'bot',
            text: decision.feedbackText,
            timestamp: timeStr,
            actions: disambigActions,
          },
        ]);
        setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
        return;
      }

      if (decision.action === 'already_exists') {
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf-exist'),
            sender: 'bot',
            text: decision.feedbackText,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: "📱 Odatlarni ko'rish",
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
        setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
        return;
      }

      if (decision.action === 'mark_completed') {
        markHabitCompletedToday(decision.habit.id);
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: decision.feedbackText,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: "📱 Odatlarni ko'rish",
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
        setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
        return;
      }

      if (decision.action === 'create_new') {
        const created = addHabit(habitPayload);
        if (decision.shouldMarkCompletion) {
          markHabitCompletedToday(created.id);
        }
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: decision.feedbackText,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: "📱 Mini App'da ko'rish",
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
        setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
        return;
      }
    };

    if (action.action === 'confirm_create' && action.payload) {
      const payload: ParsedItem & { markDoneToday?: boolean; targetHabitId?: string } = action.payload;

      // EXPENSE CONFIRMATION
      if (payload.category === 'harajat') {
        const buildRes = buildExpenseCreatePayload(payload, activeTodayStr, timeStr);
        if (!buildRes.success) {
          setMessages(prev => [
            ...prev,
            {
              id: generateEntityId('conf-err'),
              sender: 'bot',
              text: `❌ Xarajatni saqlashda xatolik: ${buildRes.error}`,
              timestamp: timeStr,
            },
          ]);
          setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
          return;
        }

        const createdExp = addExpense(buildRes.payload);
        const formattedMoneyStr = formatMoney(createdExp.amount, createdExp.currency);

        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: `🎉 Saqlandi! **${formattedMoneyStr}** - "${createdExp.title}" xarajatlar ro'yxatiga qo'shildi!`,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-harajat',
                label: '💰 Xarajatlarda ko\'rish',
                action: 'open_miniapp',
                payload: { tab: 'harajatlar' },
                variant: 'primary',
              },
            ],
          },
        ]);
      }
      // HEALTH INTAKE (Qabul - Kreatin, L-Arginin, Asalli suv)
      else if (payload.category === 'qabul') {
        const buildRes = buildHabitCreatePayload(payload);
        if (!buildRes.success) {
          setMessages(prev => [
            ...prev,
            {
              id: generateEntityId('conf-err'),
              sender: 'bot',
              text: `❌ Qabulni saqlashda xatolik: ${buildRes.error}`,
              timestamp: timeStr,
            },
          ]);
          setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
          return;
        }

        executeQabulDecision(payload, buildRes.payload, payload.markDoneToday === true);
      }
      // TASK OR MEETING
      else if (payload.category === 'vazifa' || payload.category === 'uchrashuv') {
        const buildRes = buildTaskCreatePayload(payload, activeTodayStr);
        if (!buildRes.success) {
          setMessages(prev => [
            ...prev,
            {
              id: generateEntityId('conf-err'),
              sender: 'bot',
              text: `❌ Vazifani saqlashda xatolik: ${buildRes.error}`,
              timestamp: timeStr,
            },
          ]);
          setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
          return;
        }

        const createdTask = addTask(buildRes.payload);

        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: `🎉 Saqlandi! **"${createdTask.title}"** Mini App vazifalar ro'yxatiga qo'shildi.\n📅 Sana: ${formatUzbekDateLabel(createdTask.date, createdTask.time)}`,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: '📱 Mini App\'da ko\'rish',
                action: 'open_miniapp',
                variant: 'primary',
              },
              {
                id: 'test-remind',
                label: '🔔 Eslatmani sinash',
                action: 'mark_done',
                payload: { taskId: createdTask.id, title: createdTask.title },
                variant: 'secondary',
              },
            ],
          },
        ]);
      } else if (payload.category === 'odat') {
        const buildRes = buildHabitCreatePayload(payload);
        if (!buildRes.success) {
          setMessages(prev => [
            ...prev,
            {
              id: generateEntityId('conf-err'),
              sender: 'bot',
              text: `❌ Odatni saqlashda xatolik: ${buildRes.error}`,
              timestamp: timeStr,
            },
          ]);
          setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m)));
          return;
        }

        const createdHabit = addHabit(buildRes.payload);

        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: `🎉 Yangi odat saqlandi: **"${createdHabit.title}"**!\nHar kuni belgilashni unutmang.`,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: '📱 Mini App\'da ko\'rish',
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
      } else if (payload.category === 'maqsad') {
        const createdGoal = addGoal({
          title: payload.title,
          category: 'maqsad',
          deadline: payload.date || `${activeTodayStr.slice(0, 7)}-30`,
          targetValue: payload.quantity || 100,
          currentValue: 0,
          unit: payload.unit || 'birlik',
          linkedHabitIds: [],
        });

        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('conf'),
            sender: 'bot',
            text: `🎯 Yangi maqsad belgilandi: **"${createdGoal.title}"**!\nKichik qadamlar bilan katta natijaga erishamiz.`,
            timestamp: timeStr,
            actions: [
              {
                id: 'open-app',
                label: '📱 Mini App\'da ko\'rish',
                action: 'open_miniapp',
                variant: 'primary',
              },
            ],
          },
        ]);
      }

      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m))
      );
    } else if (action.action === 'clarify_type' && action.payload) {
      const p = action.payload as ParsedItem;
      const res = processEntityCreationFromParsed(p, activeTodayStr, timeStr);

      if (!res.success) {
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('res-err'),
            sender: 'bot',
            text: `❌ ${res.error}`,
            timestamp: timeStr,
          },
        ]);
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m))
        );
        return;
      }

      if (res.entityType === 'harajat') {
        const createdExp = addExpense(res.payload);
        const formattedMoneyStr = formatMoney(createdExp.amount, createdExp.currency);
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('res'),
            sender: 'bot',
            text: `💸 Xarajat saqlandi: "${createdExp.title}" (${formattedMoneyStr})`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Xarajatlarni ochish', action: 'open_miniapp', payload: { tab: 'harajatlar' }, variant: 'primary' }],
          },
        ]);
      } else if (res.entityType === 'qabul') {
        executeQabulDecision(p, res.payload, res.markDoneToday === true);
      } else if (res.entityType === 'vazifa' || res.entityType === 'uchrashuv') {
        const createdTask = addTask(res.payload);
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('res'),
            sender: 'bot',
            text: `✅ ${createdTask.category === 'uchrashuv' ? 'Uchrashuv' : 'Vazifa'} sifatida saqlandi: "${createdTask.title}" (${formatUzbekDateLabel(createdTask.date, createdTask.time)})`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Mini App\'ni ochish', action: 'open_miniapp', variant: 'primary' }],
          },
        ]);
      } else if (res.entityType === 'odat') {
        const createdHabit = addHabit(res.payload);
        let freqDesc = 'Har kuni';
        if (createdHabit.frequency === 'weekly_target') {
          freqDesc = `Haftasiga ${createdHabit.targetDaysPerWeek} kun`;
        } else if (createdHabit.frequency === 'specific_days') {
          freqDesc = `Tanlangan kunlar: ${createdHabit.daysOfWeek.join(', ')}`;
        }
        setMessages(prev => [
          ...prev,
          {
            id: generateEntityId('res'),
            sender: 'bot',
            text: `🔁 Odat sifatida saqlandi: "${createdHabit.title}" (${freqDesc})`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Mini App\'ni ochish', action: 'open_miniapp', variant: 'primary' }],
          },
        ]);
      }
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m))
      );
    } else if (action.action === 'cancel_prompt') {
      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('canc'),
          sender: 'bot',
          text: 'Bekor qilindi. Boshqa biror ish kiritishingiz mumkin.',
          timestamp: timeStr,
        },
      ]);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, actions: undefined } : m))
      );
    } else if (action.action === 'open_miniapp') {
      setDisplayMode('miniapp');
      if (action.payload?.tab) {
        setActiveTab(action.payload.tab);
      } else {
        setActiveTab('bosh_sahifa');
      }
    } else if (action.action === 'mark_done' && action.payload) {
      triggerSimulatedReminder(action.payload.title);
    } else if (action.action === 'edit_time' && action.payload) {
      setMessages(prev => [
        ...prev,
        {
          id: generateEntityId('edit'),
          sender: 'bot',
          text: `Vaqtni o'zgartirish uchun yangi vaqtni yozing (masalan: "ertaga soat 17:00 da ${action.payload.title}")`,
          timestamp: timeStr,
        },
      ]);
    }
  };

  const triggerSimulatedReminder = (customTitle?: string) => {
    const title = customTitle || 'Hisobot yuborish (Boshqaruv uchun)';
    const text = `🔔 **ESLATMA VAQTI KELDI!**\n\n📌 **${title}**\n⏰ Belgilangan vaqti: Hozir\n\nVazifani bajargan bo'lsangiz, tasdiqlang:`;

    const reminderMsg: ChatMessage = {
      id: generateEntityId('remind'),
      sender: 'bot',
      text,
      timestamp: getTimeString(),
      isReminder: true,
      actions: [
        {
          id: 'rem-done',
          label: '✅ Bajarildi deb belgilash',
          action: 'confirm_create',
          payload: { action: 'complete_reminder' },
          variant: 'primary',
        },
        {
          id: 'rem-delay',
          label: '⏳ 15 daqiqaga kechiktirish',
          action: 'postpone_15',
          variant: 'secondary',
        },
      ],
    };

    setMessages(prev => [...prev, reminderMsg]);
    setActiveNotification({
      title: 'Kunlik Yordamchi Eslatmasi',
      body: `${title} - bajarish vaqti bo'ldi!`,
    });
  };

  const dismissNotification = () => {
    setActiveNotification(null);
  };

  const runMorningKickoff = () => {
    const today = activeTodayStr;
    const countTasks = tasks.filter(t => t.date === today && t.status === 'pending').length;
    const countHabits = habits.length;
    const morningSupplements = habits.filter(h => h.habitType === 'supplement_health');

    let msg = `🌅 **Ertalabki rejalashtirish (${settings.morningTime}):**\n\nXayrli tong, ${settings.name}!\nBugun rejangizda **${countTasks} ta** yangi vazifa va **${countHabits} ta** odat mavjud.\n`;

    if (morningSupplements.length > 0) {
      msg += `\n💊 **Ertalabki salomatlik qabullari:**\n`;
      morningSupplements.forEach(s => {
        msg += `• ${s.title} (${s.dosage || ''}) - ${s.timeSlot || 'Ertalab'}\n`;
      });
    }

    msg += `\nKunni eng muhim bitta ishni aniqlashdan boshlang. Harakatlaringiz maqsad sari yetaklasin! 🚀`;

    setMessages(prev => [
      ...prev,
      {
        id: generateEntityId('morning'),
        sender: 'bot',
        text: msg,
        timestamp: getTimeString(),
        actions: [
          {
            id: 'open-app',
            label: '📱 Bugungi ishlarni ko\'rish',
            action: 'open_miniapp',
            variant: 'primary',
          },
        ],
      },
    ]);
  };

  const runEveningReflection = () => {
    const today = activeTodayStr;
    const doneTasks = tasks.filter(t => t.date === today && t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.date === today && t.status !== 'completed').length;
    const completedHabits = habits.filter(h => h.history[today]?.completed).length;
    const todayExpenseTotal = expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);

    const msg = `🌙 **Kechki Sarhisob (${settings.eveningTime}):**\n\nBugungi kunda:\n✅ Bajarilgan vazifalar: **${doneTasks} ta**\n⏳ Qoldirilgan/kutilayotgan: **${pendingTasks} ta**\n🔁 Bajarilgan odatlar: **${completedHabits}/${habits.length} ta**\n💰 Bugungi xarajatlar: **${formatSom(todayExpenseTotal)}**\n\nBugungi mehnatingiz uchun rahmat! Ertangi kun uchun yangi rejalar tuzishni unutmang. Yaxshi dam oling! ✨`;

    setMessages(prev => [
      ...prev,
      {
        id: generateEntityId('evening'),
        sender: 'bot',
        text: msg,
        timestamp: getTimeString(),
        actions: [
          {
            id: 'open-app',
            label: '📱 Kalendar va Natijalarni ko\'rish',
            action: 'open_miniapp',
            variant: 'primary',
          },
        ],
      },
    ]);
  };

  const generateWeeklyReview = async (): Promise<string> => {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const totalWeeklyExpense = expenses.reduce((s, e) => s + e.amount, 0);

    try {
      const res = await fetch('/api/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTasksCount: completedCount,
          pendingTasksCount: pendingCount,
          habitStats: habits.map(h => ({ title: h.title, streak: h.streak })),
          goalStats: goals.map(g => ({ title: g.title, progress: `${g.currentValue}/${g.targetValue} ${g.unit}` })),
          totalExpense: totalWeeklyExpense,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reviewText) return data.reviewText;
        if (data.summary) return data.summary;
      }
    } catch {
      // fallback
    }

    return `Oxirgi haftada jami **${completedCount} ta** vazifa muvaffaqiyatli yakunlandi. Odatlar va salomatlik qabullari (kreatin, l-arginin, asalli suv) intizom bilan davom etmoqda. Jami qayd etilgan xarajatlar: ${formatSom(totalWeeklyExpense)}. Katta maqsadlaringiz sari intiling!`;
  };

  const resetToDemoData = () => {
    setTasks(defaultTasks);
    domainDispatch({ type: 'RESET_DOMAIN', habits: defaultHabits, goals: defaultGoals });
    setExpenses(defaultExpenses);
    setMessages(defaultMessages);
    setSettings(defaultSettings);
  };

  const clearAllData = () => {
    setTasks([]);
    domainDispatch({ type: 'RESET_DOMAIN', habits: [], goals: [] });
    setExpenses([]);
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_TASKS);
      localStorage.removeItem(STORAGE_KEY_HABITS);
      localStorage.removeItem(STORAGE_KEY_GOALS);
      localStorage.removeItem(STORAGE_KEY_EXPENSES);
      localStorage.removeItem(STORAGE_KEY_MSGS);
    } catch {
      // ignore
    }
    triggerHaptic('warning');
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const todayDayOfWeek = getDayOfWeekInTimezone(new Date(), settings.timezone);

  return (
    <AppContext.Provider
      value={{
        todayStr: activeTodayStr,
        timezone: settings.timezone,
        todayDayOfWeek,
        tasks,
        habits,
        goals,
        expenses,
        messages,
        settings,
        displayMode,
        activeTab,
        activeNotification,
        isAiProcessing,
        setDisplayMode,
        setActiveTab,
        addTask,
        updateTask,
        toggleTaskComplete,
        postponeTask,
        deleteTask,
        restoreTask,
        addHabit,
        updateHabit,
        toggleHabitToday,
        markHabitCompletedToday,
        logHabitQuantity,
        deleteHabit,
        restoreHabit,
        addGoal,
        updateGoal,
        updateGoalProgress,
        logGoalProgress,
        addGoalInternalHabit,
        toggleGoalInternalHabit,
        deleteGoalInternalHabit,
        deleteGoalProgressLog,
        deleteGoal,
        restoreGoal,
        addExpense,
        updateExpense,
        deleteExpense,
        exportAllDataAsJson,
        importDataFromJson,
        sendBotMessage,
        handleBotAction,
        triggerSimulatedReminder,
        dismissNotification,
        runMorningKickoff,
        runEveningReflection,
        generateWeeklyReview,
        resetToDemoData,
        clearAllData,
        updateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
