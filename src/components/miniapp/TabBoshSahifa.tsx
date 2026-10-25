import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  formatDateYMD,
  formatUzbekDateLabel,
  formatSom,
} from '../../utils/uzbekNlp';
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ArrowRight,
  Flame,
  Plus,
  Sunrise,
  Sunset,
  Calendar,
  Target,
  Check,
  AlertCircle,
  Wallet,
  Pill,
  TrendingDown,
  TrendingUp,
  Scale,
  Award,
  ChevronRight,
  ShieldCheck,
  Settings,
  Download,
  Bell,
} from 'lucide-react';

export const TabBoshSahifa: React.FC<{
  onOpenAddTask: () => void;
  onOpenAddHabit: () => void;
  onOpenAddExpense: () => void;
}> = ({ onOpenAddTask, onOpenAddHabit, onOpenAddExpense }) => {
  const {
    tasks,
    habits,
    goals,
    expenses,
    toggleTaskComplete,
    toggleHabitToday,
    setActiveTab,
    runMorningKickoff,
    runEveningReflection,
    generateWeeklyReview,
    settings,
    exportAllDataAsJson,
  } = useApp();

  const [isGeneratingAiReview, setIsGeneratingAiReview] = useState(false);
  const [aiReviewSummary, setAiReviewSummary] = useState<string | null>(null);
  const [isExportedToast, setIsExportedToast] = useState(false);

  const todayStr = formatDateYMD(new Date());

  // Today's tasks
  const todaysTasks = tasks.filter(t => t.date === todayStr && t.status !== 'cancelled' && !t.isArchived);
  const completedTasksToday = todaysTasks.filter(t => t.status === 'completed');

  // Today's habits (daily, weekly target, or specific days)
  const activeHabits = habits.filter(h => !h.isArchived);
  const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const todayHabits = activeHabits.filter(h => {
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekly_target') return true;
    if (h.frequency === 'specific_days') return h.daysOfWeek?.includes(todayDayOfWeek);
    return true;
  });
  const completedHabitsToday = todayHabits.filter(h => !!h.history[todayStr]?.completed);

  // Active Goals
  const activeGoals = goals.filter(g => !g.isArchived);
  const primaryGoal = activeGoals[0]; // Featured goal

  // Today's expenses (UZS and USD)
  const todayExpenses = expenses.filter(e => e.date === todayStr && !e.isArchived);
  const todayExpenseSumSom = todayExpenses.filter(e => e.currency !== 'USD').reduce((sum, e) => sum + e.amount, 0);
  const todayExpenseSumUsd = todayExpenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + e.amount, 0);

  // Overall Daily Completion
  const totalItemsToday = todaysTasks.length + todayHabits.length;
  const completedItemsToday = completedTasksToday.length + completedHabitsToday.length;
  const completionPercentage = totalItemsToday > 0 ? Math.round((completedItemsToday / totalItemsToday) * 100) : 100;

  // Next Upcoming Action
  const pendingTasksToday = todaysTasks.filter(t => t.status !== 'completed');
  const sortedPendingTasks = [...pendingTasksToday].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
  const nextTask = sortedPendingTasks[0];

  const handleWeeklyReviewClick = async () => {
    setIsGeneratingAiReview(true);
    const review = await generateWeeklyReview();
    setAiReviewSummary(review);
    setIsGeneratingAiReview(false);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header Greeting & Date Anchor */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>{formatUzbekDateLabel(todayStr)}</span>
            <span aria-hidden="true">·</span>
            <span>{settings.timezone.split(' ')[0]}</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white mt-1">
            Xayrli kun, {settings.name}! 👋
          </h2>
        </div>

        {/* Profile / Settings Button */}
        <button
          onClick={() => setActiveTab('sozlamalar')}
          className="flex items-center gap-2 p-1.5 pl-3 pr-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition-all active:scale-95 shadow-sm group min-h-[46px]"
          title="Sozlamalarga o'tish"
        >
          <div className="text-right hidden xs:block sm:block">
            <span className="text-xs font-semibold text-slate-200 block group-hover:text-sky-300 leading-tight">
              Sozlamalar
            </span>
            <span className="text-[11px] text-slate-400 block">Profil & Ovoz</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-md shadow-sky-500/20 shrink-0 relative">
            {settings.name.charAt(0)}
            <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700">
              <Settings className="w-3 h-3 text-sky-400" />
            </div>
          </div>
        </button>
      </div>

      {/* 2. Hero KPI Strip (4-in-1 Daily Dashboard Summary) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800/95 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">
            Kunlik umumiy progress
          </span>
          <span className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
            {completedItemsToday}/{totalItemsToday} bajarildi ({completionPercentage}%)
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* 4 Mini Stat Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1.5 border-t border-slate-800/80">
          {/* Tasks Stat */}
          <button
            onClick={() => setActiveTab('vazifalar')}
            className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-left transition-all active:scale-95"
          >
            <span className="text-xs font-medium text-slate-400 block">Vazifalar</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-extrabold text-slate-100 font-mono tabular-nums">
                {completedTasksToday.length}/{todaysTasks.length}
              </span>
              <span className="text-xs font-semibold text-sky-400">ta</span>
            </div>
          </button>

          {/* Habits Stat */}
          <button
            onClick={() => setActiveTab('maqsadlar')}
            className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-emerald-500/30 text-left transition-all active:scale-95"
          >
            <span className="text-xs font-medium text-emerald-400 block">Odatlar</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-extrabold text-emerald-300 font-mono tabular-nums">
                {completedHabitsToday.length}/{todayHabits.length}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400">bajarildi</span>
            </div>
          </button>

          {/* Expenses Stat */}
          <button
            onClick={() => setActiveTab('harajatlar')}
            className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-left transition-all active:scale-95"
          >
            <span className="text-xs font-medium text-slate-400 block">Xarajat</span>
            <div className="mt-1 truncate">
              <span className="text-base font-extrabold text-white font-mono tabular-nums">
                {todayExpenseSumUsd > 0 && todayExpenseSumSom > 0
                  ? `${formatSom(todayExpenseSumSom)} + ${todayExpenseSumUsd} $`
                  : todayExpenseSumUsd > 0
                  ? `${todayExpenseSumUsd} $`
                  : formatSom(todayExpenseSumSom)}
              </span>
            </div>
          </button>

          {/* Goal Countdown Stat */}
          <button
            onClick={() => setActiveTab('maqsadlar')}
            className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-indigo-500/30 text-left transition-all active:scale-95"
          >
            <span className="text-xs font-medium text-indigo-300 block">Asosiy maqsad</span>
            <div className="mt-1 truncate">
              {primaryGoal ? (
                <span className="text-sm font-bold text-sky-300 font-mono tabular-nums">
                  {primaryGoal.goalType === 'decrease'
                    ? `${(primaryGoal.currentValue - primaryGoal.targetValue).toFixed(1)} ${primaryGoal.unit} qoldi`
                    : `${Math.max(0, primaryGoal.targetValue - primaryGoal.currentValue)} ${primaryGoal.unit} qoldi`}
                </span>
              ) : (
                <span className="text-xs text-slate-500">Mavjud emas</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 3. KEYINGI QADAM (Next Upcoming Step Spotlight) */}
      {nextTask && (
        <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Clock className="w-3.5 h-3.5" />
              Keyingi eng muhim qadam
            </span>
            {nextTask.time && (
              <span className="font-mono tabular-nums text-sky-300 font-semibold bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-500/30">
                Soat {nextTask.time}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-slate-100 truncate">{nextTask.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {nextTask.notes || 'Belgilangan muddatda bajarish rejalashtirilgan'}
              </p>
            </div>
            <button
              onClick={() => toggleTaskComplete(nextTask.id)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>Bajarildi</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. KUNLIK ODATLAR WIDGET */}
      <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              🔁
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Kunlik Odatlar</h3>
              <p className="text-[11px] text-slate-400">Intizom va muntazam odatlar holati</p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('maqsadlar')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors min-h-[44px]"
          >
            <span>Barchasi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayHabits.length === 0 ? (
          <div className="text-center py-5 px-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <p className="text-xs text-slate-400">Kunlik odatlar kiritilmagan.</p>
            <button
              onClick={onOpenAddHabit}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Birinchi odatni qo'shish</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {todayHabits.map(habit => {
              const todayRec = habit.history[todayStr] || { completed: false, quantity: 0 };
              const isDone = todayRec.completed;

              return (
                <div
                  key={habit.id}
                  onClick={() => toggleHabitToday(habit.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 min-h-[56px] select-none ${
                    isDone
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-slate-800/80 border-slate-700/80 hover:border-emerald-500/40 active:scale-98'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-xs font-semibold truncate ${isDone ? 'text-emerald-300' : 'text-slate-100'}`}>
                        {habit.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                      {habit.dosage && <span>{habit.dosage}</span>}
                      {habit.dosage && <span aria-hidden="true">·</span>}
                      <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                        <Flame className="w-3 h-3 fill-amber-400" />
                        {habit.streak} kun
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-500 hover:text-emerald-400 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. KATTA MAQSADLAR QOLDIG'I WIDGET */}
      {activeGoals.length > 0 ? (
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Katta Maqsadlar Qoldig'i</h3>
                <p className="text-[11px] text-slate-400">Natijalar va qolgan hajm hisoboti</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('maqsadlar')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors min-h-[44px]"
            >
              <span>Barchasi</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {activeGoals.slice(0, 2).map(goal => {
              const isDec = goal.goalType === 'decrease';
              let percent = 0;
              let remaining = 0;

              if (isDec) {
                const start = goal.startValue || 90;
                const totalToLose = Math.max(0.1, start - goal.targetValue);
                const lost = Math.max(0, start - goal.currentValue);
                percent = Math.min(100, Math.round((lost / totalToLose) * 100));
                remaining = Math.max(0, goal.currentValue - goal.targetValue);
              } else {
                percent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
                remaining = Math.max(0, goal.targetValue - goal.currentValue);
              }

              return (
                <div
                  key={goal.id}
                  onClick={() => setActiveTab('maqsadlar')}
                  className="bg-slate-800/70 hover:bg-slate-800 p-3 rounded-xl border border-slate-700/60 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-100 truncate">{goal.title}</h4>
                    <span className="text-xs font-bold text-sky-400 font-mono tabular-nums shrink-0">
                      {isDec
                        ? `${remaining.toFixed(1)} ${goal.unit} qoldi`
                        : `${remaining} ${goal.unit} qoldi (${goal.targetValue} - ${goal.currentValue})`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDec
                          ? 'bg-gradient-to-r from-amber-500 to-rose-400'
                          : 'bg-gradient-to-r from-sky-500 to-emerald-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Joriy: <strong className="text-slate-200 font-mono tabular-nums">{goal.currentValue} {goal.unit}</strong> / {goal.targetValue} {goal.unit}
                    </span>
                    <span>{percent}% bajarildi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-4 text-center space-y-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200">Katta maqsadlar belgilanmagan</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">300 bet kitob, vazn tashlash yoki til o'rganish uchun maqsad qo'ying</p>
          </div>
          <button
            onClick={() => setActiveTab('maqsadlar')}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1 min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Katta maqsad qo'shish</span>
          </button>
        </div>
      )}

      {/* 6. BUGUNGI VAZIFALAR WIDGET */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-100">Bugungi Vazifalar</h3>
            <span className="text-[11px] bg-slate-800 text-slate-300 font-mono tabular-nums px-2 py-0.5 rounded-full border border-slate-700">
              {completedTasksToday.length}/{todaysTasks.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddTask}
              className="min-h-[44px] text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Qo'shish</span>
            </button>
            <button
              onClick={() => setActiveTab('vazifalar')}
              className="min-h-[44px] text-xs text-slate-400 hover:text-slate-200 transition-colors ml-1"
            >
              Hammasi →
            </button>
          </div>
        </div>

        {todaysTasks.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
            Bugun uchun faol vazifalar yo'q. "+ Qo'shish" tugmasini bosing!
          </div>
        ) : (
          <div className="space-y-2">
            {todaysTasks.slice(0, 4).map(task => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                      : 'bg-slate-800/80 border-slate-700/70 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <button
                    onClick={() => toggleTaskComplete(task.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0 min-h-[44px]"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-sky-400 shrink-0 transition-colors" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-xs sm:text-sm font-medium truncate ${
                          isDone ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        {task.time && (
                          <span className="flex items-center gap-1 text-sky-400 font-mono tabular-nums">
                            <Clock className="w-3 h-3" />
                            {task.time}
                          </span>
                        )}
                        {task.priority === 'high' && (
                          <span className="text-rose-400 font-medium">🔴 Yuqori</span>
                        )}
                        {task.category === 'uchrashuv' && (
                          <span className="text-indigo-400">🤝 Uchrashuv</span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. QUICK ACTION BUTTONS: Ertalabki reja & Kechki sarhisob */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={runMorningKickoff}
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-left transition-all active:scale-98 shadow-sm min-h-[56px]"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sunrise className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-200 block truncate">Ertalabki reja</span>
            <span className="text-[11px] text-slate-400 block truncate">Kunni boshlash</span>
          </div>
        </button>

        <button
          onClick={runEveningReflection}
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-left transition-all active:scale-98 shadow-sm min-h-[56px]"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Sunset className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-200 block truncate">Kechki yakun</span>
            <span className="text-[11px] text-slate-400 block truncate">Kun sarhisobi</span>
          </div>
        </button>
      </div>

      {/* 8. HAFTALIK AI TAHLIL KARTASI */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">Haftalik AI Tahlili</h4>
              <p className="text-[11px] text-slate-400">Intizom va natijalar bo'yicha maslahatlar</p>
            </div>
          </div>
          <button
            onClick={handleWeeklyReviewClick}
            disabled={isGeneratingAiReview}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 min-h-[44px]"
          >
            {isGeneratingAiReview ? 'Tahlil...' : 'Tahlil olish'}
          </button>
        </div>

        {aiReviewSummary ? (
          <div className="text-xs text-slate-200 bg-slate-950/70 p-3 rounded-xl border border-indigo-500/20 whitespace-pre-wrap leading-relaxed">
            {aiReviewSummary}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Vazifalar, xarajatlar va odatlar bo'yicha shaxsiy rivojlanish hisoboti va AI tavsiyalarini oling.
          </p>
        )}
      </div>

      {/* 9. TEZKOR SOZLAMALAR VA TIZIM */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">Sozlamalar va Boshqaruv</h4>
              <p className="text-[11px] text-slate-400">Profil, bildirishnomalar va ma'lumotlar</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('sozlamalar')}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 p-1 hover:underline"
          >
            <span>Barchasi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Eslatma ovozlari</span>
            <span className="font-medium text-slate-200 mt-0.5 block">
              {settings.reminderSound ? '🔔 Yoqilgan' : '🔕 O\'chirilgan'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Vaqt mintaqasi</span>
            <span className="font-medium text-slate-200 mt-0.5 block truncate">
              {settings.timezone.split(' ')[0]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/70">
          <button
            onClick={() => setActiveTab('sozlamalar')}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-slate-700 min-h-[40px]"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Sozlamalarni ochish</span>
          </button>

          <button
            onClick={() => {
              exportAllDataAsJson();
              setIsExportedToast(true);
              setTimeout(() => setIsExportedToast(false), 3000);
            }}
            className="py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-sky-500/30 min-h-[40px]"
            title="Barcha ma'lumotlarni JSON fayl qilib yuklab olish"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>{isExportedToast ? "Yuklab olindi! ✅" : "Zaxira (JSON)"}</span>
          </button>
        </div>
      </div>

      {/* Safe bottom spacer ensuring nothing is hidden behind floating nav */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
