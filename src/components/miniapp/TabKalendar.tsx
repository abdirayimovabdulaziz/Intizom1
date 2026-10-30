import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  formatDateYMD,
  formatUzbekDateLabel,
} from '../../utils/uzbekNlp';
import {
  getDayOfWeekFromYMD,
  calculateCalendarPeriodSummary,
  validateActivity,
  getCalendarPeriodBounds,
} from '../../utils/domainCalculations';
import { Activity, ActivityCategory, ACTIVITY_CATEGORIES, ActivityCreatePayload } from '../../types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  Sparkles,
  BarChart2,
  Link as LinkIcon,
} from 'lucide-react';

export const TabKalendar: React.FC = () => {
  const {
    todayStr,
    tasks,
    habits,
    activities,
    toggleTaskComplete,
    markHabitCompletedToday,
    toggleHabitToday,
    addActivity,
    updateActivity,
    deleteActivity,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  });

  // Period summary state
  const [summaryPeriod, setSummaryPeriod] = useState<'hafta' | 'oy' | 'yil'>('hafta');

  // Activity modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ActivityCategory>('sport');
  const [formDate, setFormDate] = useState(selectedDate <= todayStr ? selectedDate : todayStr);
  const [formTime, setFormTime] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLinkedHabitId, setFormLinkedHabitId] = useState('');
  const [formError, setFormError] = useState('');

  const monthNamesUz = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  const currentYear = viewDate.getUTCFullYear();
  const currentMonth = viewDate.getUTCMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(Date.UTC(currentYear, currentMonth - 1, 1, 12, 0, 0)));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(Date.UTC(currentYear, currentMonth + 1, 1, 12, 0, 0)));
  };

  const handleGoToday = () => {
    const [y, m] = todayStr.split('-').map(Number);
    setViewDate(new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)));
    setSelectedDate(todayStr);
  };

  // Calendar grid calculations using pure UTC
  const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 12, 0, 0)).getUTCDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 12, 0, 0)).getUTCDate();

  const daysGrid: (string | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysGrid.push(dStr);
  }

  // Active habits for selection
  const activeHabits = habits.filter(h => !h.isArchived);

  // Selected date items
  const selectedDayOfWeek = getDayOfWeekFromYMD(selectedDate);

  // 1. REJALAR (Planned tasks & habits scheduled for selected date)
  const pendingTasks = tasks.filter(
    t => t.date === selectedDate && t.status !== 'cancelled' && t.status !== 'completed'
  );

  const scheduledHabits = activeHabits.filter(h => {
    const isCompleted = !!h.history[selectedDate]?.completed;
    if (isCompleted) return false; // completed habits appear in "Bajarilganlar"

    if (h.frequency === 'daily') return true;
    if (h.frequency === 'specific_days' && Array.isArray(h.daysOfWeek)) {
      return h.daysOfWeek.includes(selectedDayOfWeek);
    }
    if (h.frequency === 'weekly_target') return true;
    return false;
  });

  // 2. BAJARILGANLAR (Completed tasks, activities, and standalone habit completions)
  const completedTasks = tasks.filter(
    t => t.date === selectedDate && t.status === 'completed'
  );

  const dayActivities = activities.filter(
    a => a.localDate === selectedDate
  );

  // Standalone habits: completed on selectedDate and not linked to any activity of this habit on selectedDate
  const standaloneHabits = activeHabits.filter(h => {
    const isCompleted = !!h.history[selectedDate]?.completed;
    if (!isCompleted) return false;
    // Check if an activity for this habit exists on selectedDate
    const hasLinkedAct = dayActivities.some(a => a.linkedHabitId === h.id);
    return !hasLinkedAct;
  });

  // Open modal for creating new activity
  const openCreateActivityModal = () => {
    setEditingActivityId(null);
    setFormTitle('');
    setFormCategory('sport');
    setFormDate(selectedDate <= todayStr ? selectedDate : todayStr);
    setFormTime('');
    setFormDuration('');
    setFormQuantity('');
    setFormUnit('');
    setFormNotes('');
    setFormLinkedHabitId('');
    setFormError('');
    setIsActivityModalOpen(true);
  };

  // Open modal for editing existing activity
  const openEditActivityModal = (act: Activity) => {
    setEditingActivityId(act.id);
    setFormTitle(act.title);
    setFormCategory(act.category);
    setFormDate(act.localDate);
    setFormTime(act.time || '');
    setFormDuration(act.durationMinutes ? String(act.durationMinutes) : '');
    setFormQuantity(act.quantity ? String(act.quantity) : '');
    setFormUnit(act.unit || '');
    setFormNotes(act.notes || '');
    setFormLinkedHabitId(act.linkedHabitId || '');
    setFormError('');
    setIsActivityModalOpen(true);
  };

  // Submit activity form
  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const titleTrim = formTitle.trim();
    if (!titleTrim) {
      setFormError("Faoliyat sarlavhasi (nomi) kiritilishi shart.");
      return;
    }

    if (!formDate) {
      setFormError("Sana tanlanishi shart.");
      return;
    }

    if (formDate > todayStr) {
      setFormError(`Bajarilgan faoliyat kelajak sanasiga (${formDate}) kiritilishi mumkin emas.`);
      return;
    }

    let durNum: number | undefined = undefined;
    if (formDuration.trim()) {
      durNum = parseFloat(formDuration.trim());
      if (isNaN(durNum) || !Number.isFinite(durNum) || durNum <= 0) {
        setFormError("Davomiylik (daqiqa) musbat son bo'lishi shart.");
        return;
      }
    }

    let qtyNum: number | undefined = undefined;
    if (formQuantity.trim()) {
      qtyNum = parseFloat(formQuantity.trim());
      if (isNaN(qtyNum) || !Number.isFinite(qtyNum) || qtyNum <= 0) {
        setFormError("Miqdor musbat son bo'lishi shart.");
        return;
      }
    }

    const payload: ActivityCreatePayload = {
      title: titleTrim,
      category: formCategory,
      localDate: formDate,
      time: formTime.trim() || undefined,
      durationMinutes: durNum,
      quantity: qtyNum,
      unit: formUnit.trim() || undefined,
      notes: formNotes.trim() || undefined,
      linkedHabitId: formLinkedHabitId || undefined,
      source: 'manual',
    };

    const val = validateActivity(payload, todayStr);
    if (!val.isValid) {
      setFormError(val.error || "Faoliyat ma'lumotlari noto'g'ri.");
      return;
    }

    if (editingActivityId) {
      updateActivity(editingActivityId, payload);
    } else {
      addActivity(payload);
    }

    setIsActivityModalOpen(false);
  };

  const handleDeleteActivity = (id: string) => {
    if (window.confirm("Haqiqatan ham ushbu faoliyatni o'chirmoqchimisiz?")) {
      deleteActivity(id);
      setIsActivityModalOpen(false);
    }
  };

  // Period summary metrics
  const periodSummary = calculateCalendarPeriodSummary(
    activities,
    habits,
    tasks,
    summaryPeriod,
    selectedDate
  );

  const { startDate: pStart, endDate: pEnd } = getCalendarPeriodBounds(summaryPeriod, selectedDate);

  const categoryLabels: Record<ActivityCategory, { label: string; icon: string; color: string }> = {
    sport: { label: 'Sport', icon: '🏃', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    salomatlik: { label: 'Salomatlik', icon: '🧘', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
    talim: { label: "Ta'lim", icon: '📚', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ish: { label: 'Ish', icon: '💼', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    shaxsiy: { label: 'Shaxsiy', icon: '👤', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    boshqa: { label: 'Boshqa', icon: '✨', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  };

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Calendar Header & Month Navigation */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-100">
              {monthNamesUz[currentMonth]} {currentYear}
            </h3>
            <button
              onClick={handleGoToday}
              className="text-[11px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-lg border border-sky-500/30 transition-colors"
            >
              Bugun
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Oldingi oy"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Keyingi oy"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
          {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((d, idx) => (
            <div key={idx} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map((dayStr, idx) => {
            if (!dayStr) {
              return <div key={`empty-${idx}`} className="h-9" />;
            }

            const dayNum = parseInt(dayStr.split('-')[2], 10);
            const isSelected = dayStr === selectedDate;
            const isToday = dayStr === todayStr;

            const hasTask = tasks.some(t => t.date === dayStr && t.status !== 'cancelled');
            const hasHabitRecord = habits.some(h => h.history[dayStr]?.completed);
            const hasActivityRecord = activities.some(a => a.localDate === dayStr);

            return (
              <button
                key={dayStr}
                onClick={() => setSelectedDate(dayStr)}
                className={`h-9 rounded-xl flex flex-col items-center justify-center relative text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/30'
                    : isToday
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{dayNum}</span>
                {/* Dots indicator */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  {hasTask && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-sky-400'
                      }`}
                      title="Vazifa mavjud"
                    />
                  )}
                  {(hasHabitRecord || hasActivityRecord) && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-amber-300' : 'bg-emerald-400'
                      }`}
                      title="Bajarilgan amal mavjud"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selected Day Header with "Bajarganimni qo'shish" */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-sky-400" />
          <h4 className="font-bold text-sm text-slate-100">
            {formatUzbekDateLabel(selectedDate)}
          </h4>
        </div>
        <button
          onClick={openCreateActivityModal}
          className="flex items-center gap-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Bajarganimni qo'shish
        </button>
      </div>

      {/* 3. Rejalar (Scheduled Tasks & Habits) */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Rejalar ({pendingTasks.length + scheduledHabits.length})
          </h5>
          <span className="text-[11px] text-slate-400">Kutilayotgan ishlar</span>
        </div>

        {pendingTasks.length === 0 && scheduledHabits.length === 0 ? (
          <p className="text-center py-3 text-slate-400 text-xs">
            Ushbu sanaga kutilayotgan rejalar yo'q.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Pending Tasks */}
            {pendingTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-100"
              >
                <button
                  onClick={() => toggleTaskComplete(task.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <Circle className="w-5 h-5 text-slate-400 hover:text-sky-400 shrink-0 transition-colors" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-slate-100">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      {task.time && (
                        <span className="flex items-center gap-1 text-sky-400">
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
            ))}

            {/* Scheduled Habits */}
            {scheduledHabits.map(habit => (
              <div
                key={habit.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200"
              >
                <button
                  onClick={() => toggleHabitToday(habit.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <Circle className="w-5 h-5 text-emerald-400/80 hover:text-emerald-400 shrink-0 transition-colors" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-slate-200">{habit.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="text-emerald-400">
                        {habit.habitType === 'supplement_health' ? '💊 Qabul' : '🔁 Odat'}
                      </span>
                      {habit.targetQuantity && habit.unit && (
                        <span>
                          {habit.targetQuantity} {habit.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bajarilganlar (Completed Tasks, Activities, and Standalone Habits) */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Bajarilganlar ({dayActivities.length + standaloneHabits.length + completedTasks.length})
          </h5>
          <span className="text-[11px] text-slate-400">Qayd etilgan natijalar</span>
        </div>

        {dayActivities.length === 0 && standaloneHabits.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-5 text-slate-400 text-xs">
            Ushbu sanada hali bajarilgan faoliyat yoki vazifa qayd etilmagan.
          </div>
        ) : (
          <div className="space-y-2">
            {/* A) Recorded Activities */}
            {dayActivities.map(act => {
              const catInfo = categoryLabels[act.category] || categoryLabels.boshqa;
              const linkedHabit = act.linkedHabitId ? habits.find(h => h.id === act.linkedHabitId) : null;

              return (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-100 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${catInfo.color}`}
                      >
                        <span>{catInfo.icon}</span>
                        <span>{catInfo.label}</span>
                      </span>
                      {act.time && (
                        <span className="text-xs text-sky-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {act.time}
                        </span>
                      )}
                      {act.durationMinutes && (
                        <span className="text-xs font-medium text-emerald-400">
                          ⏱️ {act.durationMinutes} daqiqa
                        </span>
                      )}
                      {act.quantity && act.unit && (
                        <span className="text-xs font-medium text-indigo-400">
                          📏 {act.quantity} {act.unit}
                        </span>
                      )}
                      {linkedHabit && (
                        <span className="text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <LinkIcon className="w-2.5 h-2.5" />
                          {linkedHabit.title}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-100">{act.title}</p>
                    {act.notes && (
                      <p className="text-xs text-slate-400 mt-1 italic">{act.notes}</p>
                    )}
                  </div>

                  <button
                    onClick={() => openEditActivityModal(act)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors shrink-0"
                    title="Tahrirlash"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            {/* B) Standalone Habit Completions (no duplicate if activity was linked) */}
            {standaloneHabits.map(habit => (
              <div
                key={habit.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-emerald-900/40 text-slate-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-slate-200">{habit.title}</p>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      ✅ {habit.habitType === 'supplement_health' ? 'Qabul qilindi' : 'Bajarildi'} (Odat)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleHabitToday(habit.id)}
                  className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Bekor qilish
                </button>
              </div>
            ))}

            {/* C) Completed Tasks */}
            {completedTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400"
              >
                <button
                  onClick={() => toggleTaskComplete(task.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-sm font-medium line-through truncate text-slate-400">
                    {task.title}
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Sarhisob (Period Summary) Section */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <h4 className="font-bold text-sm text-slate-100">Sarhisob va Tahlil</h4>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {(['hafta', 'oy', 'yil'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSummaryPeriod(p)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all capitalize ${
                  summaryPeriod === p
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'hafta' ? 'Hafta' : p === 'oy' ? 'Oy' : 'Yil'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Subtitle */}
        <div className="text-xs text-slate-400">
          Oraliq: <span className="text-slate-200 font-medium">{formatUzbekDateLabel(pStart)} – {formatUzbekDateLabel(pEnd)}</span>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl">
            <p className="text-xs text-slate-400">Jami faoliyatlar</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{periodSummary.totalActivities}</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl">
            <p className="text-xs text-slate-400">Faol kunlar</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{periodSummary.activeDaysCount} kun</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl">
            <p className="text-xs text-slate-400">Qayd etilgan vaqt</p>
            <p className="text-base font-bold text-sky-400 mt-1">
              {periodSummary.totalDurationMinutes > 0
                ? periodSummary.totalDurationMinutes >= 60
                  ? `${Math.floor(periodSummary.totalDurationMinutes / 60)} soat ${
                      periodSummary.totalDurationMinutes % 60 ? `${periodSummary.totalDurationMinutes % 60} daq` : ''
                    }`
                  : `${periodSummary.totalDurationMinutes} daq`
                : "0 daqiqa"}
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl">
            <p className="text-xs text-slate-400">Bajarilgan rejalar</p>
            <p className="text-xl font-bold text-indigo-400 mt-1">
              {periodSummary.standaloneHabitCompletions + periodSummary.completedTasksCount}
            </p>
          </div>
        </div>

        {/* Unit Quantities (Never mix minutes, pages, and km together) */}
        {Object.keys(periodSummary.unitQuantities).length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-semibold text-slate-300">Birliklar bo'yicha hajm:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(periodSummary.unitQuantities).map(([unit, qty]) => (
                <span
                  key={unit}
                  className="text-xs font-medium bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-200"
                >
                  {qty} {unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <p className="text-xs font-semibold text-slate-300">Toifalar bo'yicha:</p>
          <div className="space-y-1.5">
            {ACTIVITY_CATEGORIES.map(catKey => {
              const item = periodSummary.categoryBreakdown[catKey];
              if (!item || item.count === 0) return null;
              const catInfo = categoryLabels[catKey];

              return (
                <div
                  key={catKey}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    <span>{catInfo.icon}</span>
                    <span className="font-medium text-slate-200">{catInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{item.count} marta</span>
                    {item.totalDurationMinutes > 0 && (
                      <span className="text-emerald-400 font-medium">
                        {item.totalDurationMinutes} daq
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Activity Create/Edit Modal */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100">
                {editingActivityId ? "Faoliyatni tahrirlash" : "Bajargan faoliyatingizni qo'shish"}
              </h3>
              <button
                onClick={() => setIsActivityModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveActivity} className="space-y-3.5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sarlavha (Nomi) *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Masalan: Zalga bordim, Kitob o'qidim, Suzdim"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Toifa *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACTIVITY_CATEGORIES.map(cat => {
                    const cInfo = categoryLabels[cat];
                    const isSel = formCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setFormCategory(cat)}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1 transition-all ${
                          isSel
                            ? 'bg-sky-600 border-sky-500 text-white font-bold shadow-sm'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span>{cInfo.icon}</span>
                        <span>{cInfo.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sana * (Kelajak mumkin emas)
                  </label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vaqt (ixtiyoriy)
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Duration (Minutes) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Davomiyligi (Daqiqada, ixtiyoriy)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formDuration}
                  onChange={e => setFormDuration(e.target.value)}
                  placeholder="Masalan: 45, 60"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Miqdor (ixtiyoriy)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={formQuantity}
                    onChange={e => setFormQuantity(e.target.value)}
                    placeholder="Masalan: 5, 30"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Birlik (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    placeholder="km, bet, dars..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Link to existing habit */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mavjud odatga bog'lash (ixtiyoriy)
                </label>
                <select
                  value={formLinkedHabitId}
                  onChange={e => setFormLinkedHabitId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Bog'lanmagan --</option>
                  {activeHabits.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.title} ({h.habitType === 'supplement_health' ? 'Qabul' : 'Odat'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Bog'langan taqdirda, tanlangan kunda ushbu odat ham bajarilgan deb belgilanadi.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Izoh yoki taassurotlar (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Qanday o'tdi, muhim tafsilotlar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                {editingActivityId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(editingActivityId)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    O'chirish
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsActivityModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe bottom spacer */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
