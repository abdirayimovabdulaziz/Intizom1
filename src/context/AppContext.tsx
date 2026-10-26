import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { formatDateYMD, formatUzbekDateLabel, formatSom, formatMoney, parseUzbekIntent } from '../utils/uzbekNlp';
import { triggerHaptic } from '../utils/telegram';

interface AppContextType {
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
  const todayStr = formatDateYMD(new Date());

  // Clean empty defaults ready for user's personal usage
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
    monthlyExpenseBudget: 3500000, // 3.5 mln so'm
  };

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : defaultTasks;
    } catch {
      return defaultTasks;
    }
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HABITS);
      return saved ? JSON.parse(saved) : defaultHabits;
    } catch {
      return defaultHabits;
    }
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GOALS);
      return saved ? JSON.parse(saved) : defaultGoals;
    } catch {
      return defaultGoals;
    }
  });

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

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
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
      id: `task-${Date.now()}`,
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
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          if (typeof minutesOrDate === 'number') {
            const [h, m] = (t.time || '12:00').split(':').map(Number);
            const dateObj = new Date();
            dateObj.setHours(h, m + minutesOrDate);
            const newTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            return { ...t, time: newTime, status: 'postponed' };
          } else {
            return { ...t, date: minutesOrDate, status: 'postponed' };
          }
        }
        return t;
      })
    );
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
      id: `habit-${Date.now()}`,
      streak: 0,
      bestStreak: 0,
      currentQuantityToday: 0,
      history: {},
    };
    setHabits(prev => [habit, ...prev]);
    triggerHaptic('light');
    return habit;
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setHabits(prev => prev.map(h => (h.id === id ? { ...h, ...updates } : h)));
    triggerHaptic('light');
  };

  const toggleHabitToday = (id: string) => {
    const today = formatDateYMD(new Date());
    setHabits(prev =>
      prev.map(h => {
        if (h.id === id) {
          const todayRecord = h.history[today] || { completed: false, quantity: 0 };
          const willBeCompleted = !todayRecord.completed;
          const newQuantity = willBeCompleted ? (h.targetQuantity || 1) : 0;
          const diffQuantity = newQuantity - (todayRecord.quantity || 0);

          triggerHaptic(willBeCompleted ? 'success' : 'selection');

          const updatedHistory = {
            ...h.history,
            [today]: {
              completed: willBeCompleted,
              quantity: newQuantity,
              timestamp: new Date().toISOString(),
            },
          };

          const newStreak = willBeCompleted ? h.streak + 1 : Math.max(0, h.streak - 1);
          const newBestStreak = Math.max(h.bestStreak, newStreak);

          if (h.linkedGoalId && diffQuantity !== 0) {
            updateGoalProgress(h.linkedGoalId, diffQuantity);
          }

          return {
            ...h,
            streak: newStreak,
            bestStreak: newBestStreak,
            currentQuantityToday: newQuantity,
            history: updatedHistory,
          };
        }
        return h;
      })
    );
  };

  const logHabitQuantity = (id: string, amount: number) => {
    const today = formatDateYMD(new Date());
    setHabits(prev =>
      prev.map(h => {
        if (h.id === id) {
          const todayRecord = h.history[today] || { completed: false, quantity: 0 };
          const prevQty = todayRecord.quantity || 0;
          const newQty = Math.max(0, prevQty + amount);
          const isDone = h.targetQuantity ? newQty >= h.targetQuantity : newQty > 0;

          if (h.linkedGoalId && amount !== 0) {
            updateGoalProgress(h.linkedGoalId, amount);
          }

          const updatedHistory = {
            ...h.history,
            [today]: {
              completed: isDone,
              quantity: newQty,
              timestamp: new Date().toISOString(),
            },
          };

          return {
            ...h,
            currentQuantityToday: newQty,
            streak: isDone && !todayRecord.completed ? h.streak + 1 : h.streak,
            history: updatedHistory,
          };
        }
        return h;
      })
    );
  };

  const deleteHabit = (id: string, permanent: boolean = false) => {
    if (permanent) {
      setHabits(prev => prev.filter(h => h.id !== id));
    } else {
      setHabits(prev => prev.map(h => (h.id === id ? { ...h, isArchived: true } : h)));
    }
  };

  const restoreHabit = (id: string) => {
    setHabits(prev => prev.map(h => (h.id === id ? { ...h, isArchived: false } : h)));
  };

  const addGoal = (newGoalData: Omit<Goal, 'id' | 'status'>): Goal => {
    const goal: Goal = {
      ...newGoalData,
      id: `goal-${Date.now()}`,
      status: 'active',
    };
    setGoals(prev => [goal, ...prev]);
    return goal;
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)));
    triggerHaptic('light');
  };

  const updateGoalProgress = (id: string, deltaAmount: number) => {
    setGoals(prev =>
      prev.map(g => {
        if (g.id === id) {
          const newVal = Math.max(0, g.currentValue + deltaAmount);
          const achieved = newVal >= g.targetValue;
          return {
            ...g,
            currentValue: newVal,
            status: achieved ? 'achieved' : 'active',
          };
        }
        return g;
      })
    );
  };

  const deleteGoal = (id: string, permanent: boolean = false) => {
    if (permanent) {
      setGoals(prev => prev.filter(g => g.id !== id));
    } else {
      setGoals(prev => prev.map(g => (g.id === id ? { ...g, isArchived: true } : g)));
    }
  };

  const restoreGoal = (id: string) => {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, isArchived: false } : g)));
  };

  const logGoalProgress = (goalId: string, amount: number, note?: string) => {
    const today = formatDateYMD(new Date());
    const timeStr = getTimeString();
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId) {
          const isDecrease = g.goalType === 'decrease';
          const newVal = isDecrease
            ? Math.max(0, g.currentValue - amount)
            : Math.max(0, g.currentValue + amount);

          const achieved = isDecrease ? newVal <= g.targetValue : newVal >= g.targetValue;
          const remaining = isDecrease
            ? Math.max(0, newVal - g.targetValue)
            : Math.max(0, g.targetValue - newVal);

          const newLog: GoalProgressLog = {
            id: `log-${Date.now()}`,
            date: today,
            time: timeStr,
            amount,
            note: note || undefined,
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
      })
    );
  };

  const deleteGoalProgressLog = (goalId: string, logId: string) => {
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId && g.progressLogs) {
          const targetLog = g.progressLogs.find(l => l.id === logId);
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
            progressLogs: g.progressLogs.filter(l => l.id !== logId),
          };
        }
        return g;
      })
    );
  };

  const addGoalInternalHabit = (goalId: string, title: string, targetFrequency: string) => {
    const newHabit: GoalInternalHabit = {
      id: `ghabit-${Date.now()}`,
      title,
      targetFrequency,
      completedToday: false,
      streak: 0,
    };
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId) {
          return {
            ...g,
            internalHabits: [...(g.internalHabits || []), newHabit],
          };
        }
        return g;
      })
    );
  };

  const toggleGoalInternalHabit = (goalId: string, habitId: string) => {
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId && g.internalHabits) {
          return {
            ...g,
            internalHabits: g.internalHabits.map(h => {
              if (h.id === habitId) {
                const nextState = !h.completedToday;
                return {
                  ...h,
                  completedToday: nextState,
                  streak: nextState ? (h.streak || 0) + 1 : Math.max(0, (h.streak || 0) - 1),
                };
              }
              return h;
            }),
          };
        }
        return g;
      })
    );
  };

  const deleteGoalInternalHabit = (goalId: string, habitId: string) => {
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId && g.internalHabits) {
          return {
            ...g,
            internalHabits: g.internalHabits.filter(h => h.id !== habitId),
          };
        }
        return g;
      })
    );
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
      id: `exp-${Date.now()}`,
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
      if (Array.isArray(data.habits)) {
        setHabits(data.habits);
        loadedCount += data.habits.length;
      }
      if (Array.isArray(data.goals)) {
        setGoals(data.goals);
        loadedCount += data.goals.length;
      }
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
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // Bot Chat Flow and Uzbek NLP handling
  const sendBotMessage = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const timeStr = getTimeString();
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
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
      const parsed: ParsedItem = await parseUzbekIntent(trimmed);

      // Handle Ambiguous input
      if (parsed.category === 'noaniq') {
        const botReply: ChatMessage = {
          id: `msg-bot-${Date.now()}`,
          sender: 'bot',
          text: `🤔 Siz kiritgan yozuv: **"${parsed.title}"**\n\nIltimos, ushbu yozuv qaysi toifaga mansubligini tanlang:`,
          timestamp: getTimeString(),
          parsedItem: parsed,
          actions: [
            {
              id: 'clarify-vazifa',
              label: '📌 Vazifa',
              action: 'clarify_type',
              payload: { category: 'vazifa', title: parsed.title, date: parsed.date, time: parsed.time },
              variant: 'primary',
            },
            {
              id: 'clarify-harajat',
              label: '💰 Xarajat',
              action: 'clarify_type',
              payload: { category: 'harajat', title: parsed.title, amount: parsed.amount || 20000 },
              variant: 'primary',
            },
            {
              id: 'clarify-qabul',
              label: '💊 Salomatlik / Qabul',
              action: 'clarify_type',
              payload: { category: 'qabul', title: parsed.title, dosage: parsed.dosage || '5g' },
              variant: 'secondary',
            },
            {
              id: 'clarify-odat',
              label: '🔁 Odat',
              action: 'clarify_type',
              payload: { category: 'odat', title: parsed.title, quantity: parsed.quantity, unit: parsed.unit },
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
        const amountDisplay = parsed.amount ? formatSom(parsed.amount) : '0 so\'m';
        const categoryLabel = parsed.expenseCategory ? parsed.expenseCategory.replace('_', ' ') : 'shaxsiy';

        responseText = `💸 **Yangi Xarajat aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}\n💰 **Summa:** ${amountDisplay}\n🏷 **Toifa:** ${categoryLabel}\n📅 **Sana:** Bugun (${parsed.date || todayStr})`;

        actions.push(
          {
            id: `confirm-exp-${Date.now()}`,
            label: '✅ Xarajatni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: `cancel-${Date.now()}`,
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
            id: `mark-intake-${Date.now()}`,
            label: '✅ Bugun qabul qilindi',
            action: 'confirm_create',
            payload: { ...parsed, markDoneToday: true },
            variant: 'primary',
          },
          {
            id: `add-routine-${Date.now()}`,
            label: '🔁 Doimiy odatga qo\'shish',
            action: 'confirm_create',
            payload: { ...parsed, markDoneToday: false },
            variant: 'secondary',
          },
          {
            id: `cancel-${Date.now()}`,
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      }
      // TASKS & MEETINGS
      else if (parsed.category === 'vazifa' || parsed.category === 'uchrashuv') {
        const dateLabel = formatUzbekDateLabel(parsed.date || todayStr, parsed.time);
        responseText = `✅ **${parsed.category === 'uchrashuv' ? 'Uchrashuv' : 'Vazifa'} aniqlandi:**\n\n📌 **Nomi:** ${parsed.title}\n📅 **Sana:** ${dateLabel}\n⏰ **Vaqt:** ${parsed.time || 'Belgilanmagan (kun davomida)'}\n🌍 **Vaqt zonasi:** ${settings.timezone}`;

        actions.push(
          {
            id: `confirm-${Date.now()}`,
            label: '✅ Tasdiqlash va Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: `edit-${Date.now()}`,
            label: '✏️ Vaqtni o\'zgartirish',
            action: 'edit_time',
            payload: parsed,
            variant: 'secondary',
          },
          {
            id: `cancel-${Date.now()}`,
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
        responseText += `\n📅 **Davriyligi:** ${(parsed.daysOfWeek as any)?.includes('daily') ? 'Har kuni' : 'Haftaning tanlangan kunlari'}`;

        actions.push(
          {
            id: `confirm-${Date.now()}`,
            label: '✅ Odatni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: `cancel-${Date.now()}`,
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
            id: `confirm-${Date.now()}`,
            label: '✅ Maqsadni Saqlash',
            action: 'confirm_create',
            payload: parsed,
            variant: 'primary',
          },
          {
            id: `cancel-${Date.now()}`,
            label: '❌ Bekor qilish',
            action: 'cancel_prompt',
            variant: 'danger',
          }
        );
      }

      const botReply: ChatMessage = {
        id: `msg-bot-${Date.now()}`,
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
          id: `msg-err-${Date.now()}`,
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
          id: `cmd-start-${Date.now()}`,
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
      const todayExpenses = expenses.filter(e => e.date === todayStr);
      const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
      const monthPrefix = todayStr.slice(0, 7);
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
          id: `cmd-exp-${Date.now()}`,
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
          const isDone = sh.history[todayStr]?.completed;
          const statusIcon = isDone ? '✅' : '⏳';
          text += `${statusIcon} **${sh.title}** (${sh.dosage || ''})\n   ⏰ ${sh.timeSlot || 'Kunlik'}\n`;
        });
      }

      setMessages(prev => [
        ...prev,
        {
          id: `cmd-salom-${Date.now()}`,
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
      const today = formatDateYMD(new Date());
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
          id: `cmd-bugun-${Date.now()}`,
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
            id: `cmd-hisobot-${Date.now()}`,
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
          id: `cmd-help-${Date.now()}`,
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

    if (action.action === 'confirm_create' && action.payload) {
      const payload: ParsedItem & { markDoneToday?: boolean } = action.payload;

      // EXPENSE CONFIRMATION
      if (payload.category === 'harajat') {
        const createdExp = addExpense({
          title: payload.title,
          amount: payload.amount || 0,
          currency: payload.currency || 'UZS',
          category: payload.expenseCategory || 'shaxsiy',
          date: payload.date || todayStr,
          time: payload.time || timeStr,
          source: 'bot',
        });

        const formattedMoneyStr = formatMoney(createdExp.amount, createdExp.currency || 'UZS');

        setMessages(prev => [
          ...prev,
          {
            id: `conf-${Date.now()}`,
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
        // Check if habit already exists
        const existing = habits.find(
          h => h.title.toLowerCase().includes(payload.title.toLowerCase()) ||
               payload.title.toLowerCase().includes(h.title.toLowerCase())
        );

        if (existing) {
          // Toggle or mark completed
          if (!existing.history[todayStr]?.completed) {
            toggleHabitToday(existing.id);
          }
          setMessages(prev => [
            ...prev,
            {
              id: `conf-${Date.now()}`,
              sender: 'bot',
              text: `✅ Qabul qilindi! **"${existing.title}"** bugungi ro'yxatda bajarilgan deb belgilandi! (🔥 ${existing.streak + 1} kun uzluksiz)`,
              timestamp: timeStr,
              actions: [
                {
                  id: 'open-app',
                  label: '📱 Odatlarni ko\'rish',
                  action: 'open_miniapp',
                  variant: 'primary',
                },
              ],
            },
          ]);
        } else {
          // Create new habit
          const created = addHabit({
            title: payload.title,
            category: 'odat',
            habitType: 'supplement_health',
            dosage: payload.dosage || undefined,
            timeSlot: payload.timeSlot || undefined,
            frequency: 'daily',
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            hasQuantity: !!payload.quantity,
            targetQuantity: payload.quantity || undefined,
            unit: payload.unit || 'gram',
          });

          if (payload.markDoneToday) {
            toggleHabitToday(created.id);
          }

          setMessages(prev => [
            ...prev,
            {
              id: `conf-${Date.now()}`,
              sender: 'bot',
              text: `🎉 Yangi qabul saqlandi: **"${created.title}"** (${payload.dosage || ''})!\nHar kuni belgilashingiz mumkin.`,
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
      }
      // TASK OR MEETING
      else if (payload.category === 'vazifa' || payload.category === 'uchrashuv') {
        const createdTask = addTask({
          title: payload.title,
          category: payload.category,
          date: payload.date || todayStr,
          time: payload.time || undefined,
          status: 'pending',
          priority: 'medium',
          source: 'bot',
        });

        setMessages(prev => [
          ...prev,
          {
            id: `conf-${Date.now()}`,
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
        const createdHabit = addHabit({
          title: payload.title,
          category: 'odat',
          habitType: 'general',
          frequency: (payload.daysOfWeek as any)?.includes('daily') ? 'daily' : 'specific_days',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          hasQuantity: !!(payload.quantity && payload.unit),
          targetQuantity: payload.quantity || undefined,
          unit: payload.unit || undefined,
        });

        setMessages(prev => [
          ...prev,
          {
            id: `conf-${Date.now()}`,
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
          deadline: payload.date || `${todayStr.slice(0, 7)}-30`,
          targetValue: payload.quantity || 100,
          currentValue: 0,
          unit: payload.unit || 'birlik',
          linkedHabitIds: [],
        });

        setMessages(prev => [
          ...prev,
          {
            id: `conf-${Date.now()}`,
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
      const p = action.payload;
      if (p.category === 'harajat') {
        addExpense({
          title: p.title,
          amount: p.amount || 20000,
          category: 'shaxsiy',
          date: todayStr,
          time: timeStr,
          source: 'bot',
        });
        setMessages(prev => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            sender: 'bot',
            text: `💸 Xarajat saqlandi: "${p.title}" (${formatSom(p.amount || 20000)})`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Xarajatlarni ochish', action: 'open_miniapp', payload: { tab: 'harajatlar' }, variant: 'primary' }],
          },
        ]);
      } else if (p.category === 'qabul') {
        addHabit({
          title: p.title,
          category: 'odat',
          habitType: 'supplement_health',
          dosage: p.dosage || '5 gram',
          timeSlot: 'Kunlik',
          frequency: 'daily',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          hasQuantity: true,
          targetQuantity: 1,
          unit: 'qabul',
        });
        setMessages(prev => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            sender: 'bot',
            text: `💊 Salomatlik qabuli saqlandi: "${p.title}"`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Mini App\'ni ochish', action: 'open_miniapp', variant: 'primary' }],
          },
        ]);
      } else if (p.category === 'vazifa') {
        addTask({
          title: p.title,
          category: 'vazifa',
          date: p.date || todayStr,
          time: p.time || undefined,
          status: 'pending',
          priority: 'medium',
          source: 'bot',
        });
        setMessages(prev => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            sender: 'bot',
            text: `✅ Vazifa sifatida saqlandi: "${p.title}"`,
            timestamp: timeStr,
            actions: [{ id: 'opn', label: '📱 Mini App\'ni ochish', action: 'open_miniapp', variant: 'primary' }],
          },
        ]);
      } else if (p.category === 'odat') {
        addHabit({
          title: p.title,
          category: 'odat',
          habitType: 'general',
          frequency: 'daily',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          hasQuantity: !!p.quantity,
          targetQuantity: p.quantity,
          unit: p.unit,
        });
        setMessages(prev => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            sender: 'bot',
            text: `🔁 Odat sifatida saqlandi: "${p.title}"`,
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
          id: `canc-${Date.now()}`,
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
          id: `edit-${Date.now()}`,
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
      id: `remind-${Date.now()}`,
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
    const today = formatDateYMD(new Date());
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
        id: `morning-${Date.now()}`,
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
    const today = formatDateYMD(new Date());
    const doneTasks = tasks.filter(t => t.date === today && t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.date === today && t.status !== 'completed').length;
    const completedHabits = habits.filter(h => h.history[today]?.completed).length;
    const todayExpenseTotal = expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);

    const msg = `🌙 **Kechki Sarhisob (${settings.eveningTime}):**\n\nBugungi kunda:\n✅ Bajarilgan vazifalar: **${doneTasks} ta**\n⏳ Qoldirilgan/kutilayotgan: **${pendingTasks} ta**\n🔁 Bajarilgan odatlar: **${completedHabits}/${habits.length} ta**\n💰 Bugungi xarajatlar: **${formatSom(todayExpenseTotal)}**\n\nBugungi mehnatingiz uchun rahmat! Ertangi kun uchun yangi rejalar tuzishni unutmang. Yaxshi dam oling! ✨`;

    setMessages(prev => [
      ...prev,
      {
        id: `evening-${Date.now()}`,
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
    setHabits(defaultHabits);
    setGoals(defaultGoals);
    setExpenses(defaultExpenses);
    setMessages(defaultMessages);
    setSettings(defaultSettings);
  };

  const clearAllData = () => {
    setTasks([]);
    setHabits([]);
    setGoals([]);
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

  return (
    <AppContext.Provider
      value={{
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
