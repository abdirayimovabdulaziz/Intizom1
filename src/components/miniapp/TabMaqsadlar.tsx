import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateYMD } from '../../utils/uzbekNlp';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  TrendingUp,
  Sparkles,
  Trash2,
  X,
  Award,
  RotateCcw,
  Archive,
  BookOpen,
  Dumbbell,
  Scale,
  ListTodo,
  Check,
  ChevronDown,
  ChevronUp,
  Repeat,
  Target,
  Pencil,
} from 'lucide-react';
import { TabOdatlar } from './TabOdatlar';

export const TabMaqsadlar: React.FC<{
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  defaultSubTab?: 'maqsadlar' | 'odatlar';
  isAddHabitModalOpen?: boolean;
  setIsAddHabitModalOpen?: (open: boolean) => void;
}> = ({
  isAddModalOpen,
  setIsAddModalOpen,
  defaultSubTab = 'maqsadlar',
  isAddHabitModalOpen = false,
  setIsAddHabitModalOpen,
}) => {
  const {
    goals,
    habits,
    addGoal,
    updateGoal,
    deleteGoal,
    restoreGoal,
    logGoalProgress,
    deleteGoalProgressLog,
    addGoalInternalHabit,
    toggleGoalInternalHabit,
    deleteGoalInternalHabit,
    todayStr,
  } = useApp();

  const [subTab, setSubTab] = useState<'maqsadlar' | 'odatlar'>(defaultSubTab);

  useEffect(() => {
    if (defaultSubTab) {
      setSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const [viewFilter, setViewFilter] = useState<'active' | 'archived'>('active');

  // New Goal Form State
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<'reach' | 'decrease'>('reach');
  const [startValue, setStartValue] = useState<number>(90);
  const [targetValue, setTargetValue] = useState<number>(300);
  const [unit, setUnit] = useState('bet');
  const [deadline, setDeadline] = useState(`${todayStr.slice(0, 7)}-30`);
  const [notes, setNotes] = useState('');

  // Edit Goal Form State
  const [editingGoal, setEditingGoal] = useState<(typeof goals)[0] | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGoalType, setEditGoalType] = useState<'reach' | 'decrease'>('reach');
  const [editStartValue, setEditStartValue] = useState<number>(90);
  const [editTargetValue, setEditTargetValue] = useState<number>(300);
  const [editCurrentValue, setEditCurrentValue] = useState<number>(0);
  const [editUnit, setEditUnit] = useState('bet');
  const [editDeadline, setEditDeadline] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openEditModal = (goal: (typeof goals)[0]) => {
    setEditingGoal(goal);
    setEditTitle(goal.title);
    setEditGoalType(goal.goalType || 'reach');
    setEditStartValue(goal.startValue || 90);
    setEditTargetValue(goal.targetValue);
    setEditCurrentValue(goal.currentValue);
    setEditUnit(goal.unit || 'birlik');
    setEditDeadline(goal.deadline);
    setEditNotes(goal.notes || '');
  };

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editTitle.trim()) return;

    updateGoal(editingGoal.id, {
      title: editTitle.trim(),
      goalType: editGoalType,
      startValue: editGoalType === 'decrease' ? Number(editStartValue) : undefined,
      targetValue: Number(editTargetValue),
      currentValue: Number(editCurrentValue),
      unit: editUnit.trim() || 'birlik',
      deadline: editDeadline,
      notes: editNotes.trim() || undefined,
    });

    setEditingGoal(null);
  };

  // Explicit Progress Log Modal
  const [selectedGoalIdForLog, setSelectedGoalIdForLog] = useState<string | null>(null);
  const [logAmount, setLogAmount] = useState<number>(30);
  const [logNote, setLogNote] = useState<string>('');

  // Add Internal Habit Modal / Inline State
  const [activeGoalForHabitAdd, setActiveGoalForHabitAdd] = useState<string | null>(null);
  const [internalHabitTitle, setInternalHabitTitle] = useState('');
  const [internalHabitFreq, setInternalHabitFreq] = useState('Har kuni');

  // Expanded Goal IDs for viewing logs & sub-habits
  const [expandedLogsGoalId, setExpandedLogsGoalId] = useState<string | null>(null);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addGoal({
      title: title.trim(),
      category: 'maqsad',
      goalType,
      startValue: goalType === 'decrease' ? Number(startValue) : undefined,
      targetValue: Number(targetValue),
      currentValue: goalType === 'decrease' ? Number(startValue) : 0,
      unit: unit.trim() || 'birlik',
      deadline,
      linkedHabitIds: [],
      notes: notes.trim() || undefined,
      progressLogs: [],
      internalHabits: [],
    });

    setTitle('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const handleApplyLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalIdForLog || !logAmount) return;

    logGoalProgress(selectedGoalIdForLog, Number(logAmount), logNote.trim() || undefined);
    setSelectedGoalIdForLog(null);
    setLogNote('');
  };

  const handleAddInternalHabitSubmit = (goalId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!internalHabitTitle.trim()) return;

    addGoalInternalHabit(goalId, internalHabitTitle.trim(), internalHabitFreq);
    setInternalHabitTitle('');
    setActiveGoalForHabitAdd(null);
  };

  const getDaysLeft = (deadlineStr: string) => {
    const target = new Date(deadlineStr);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const activeGoals = goals.filter(g => !g.isArchived);
  const archivedGoals = goals.filter(g => g.isArchived);
  const displayList = viewFilter === 'active' ? activeGoals : archivedGoals;

  return (
    <div className="space-y-4 pb-6">
      {/* Top Segment Switcher: Katta Maqsadlar vs Kunlik Odatlar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-1 rounded-2xl shadow-sm">
        <div className="grid grid-cols-2 gap-1 w-full">
          <button
            onClick={() => setSubTab('maqsadlar')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
              subTab === 'maqsadlar'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Katta Maqsadlar ({activeGoals.length})</span>
          </button>
          <button
            onClick={() => setSubTab('odatlar')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
              subTab === 'odatlar'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Kunlik Odatlar ({habits.filter(h => !h.isArchived).length})</span>
          </button>
        </div>
      </div>

      {subTab === 'odatlar' ? (
        <TabOdatlar
          isAddModalOpen={isAddHabitModalOpen}
          setIsAddModalOpen={setIsAddHabitModalOpen || (() => {})}
        />
      ) : (
        <>
          {/* Top Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Katta Maqsadlar</h2>
              <p className="text-xs text-slate-400">
                Alohida ichki odatlar, qoldiq hisobi va qo'lda aniq bog'lash
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi maqsad</span>
            </button>
          </div>

          {/* Filter Tabs: Active vs Archive */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewFilter('active')}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-all ${
                viewFilter === 'active'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              Faol maqsadlar ({activeGoals.length})
            </button>
            <button
              onClick={() => setViewFilter('archived')}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                viewFilter === 'archived'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Arxiv ({archivedGoals.length})</span>
            </button>
          </div>

      {/* Goals Cards */}
      <div className="space-y-4">
        {displayList.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="text-slate-300 font-semibold">
              {viewFilter === 'active'
                ? "Hozircha faol maqsadlar belgilanmagan"
                : "Arxivda maqsadlar mavjud emas"}
            </p>
            <p className="text-slate-400 text-[11px]">
              {viewFilter === 'active'
                ? "300 bet kitob o'qish, ozish yoki yangi marra bo'yicha katta maqsadingizni belgilang!"
                : "O'chirilgan maqsadlar bu yerda xavfsiz saqlanadi."}
            </p>
            {viewFilter === 'active' && (
              <div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Birinchi maqsadni belgilash</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          displayList.map(goal => {
            const isDecrease = goal.goalType === 'decrease';
            const daysLeft = getDaysLeft(goal.deadline);

            let percent = 0;
            let remaining = 0;
            let isAchieved = false;

            if (isDecrease) {
              const start = goal.startValue || 90;
              const target = goal.targetValue;
              const current = goal.currentValue;
              const totalToLose = Math.max(0.1, start - target);
              const lostSoFar = Math.max(0, start - current);
              percent = Math.min(100, Math.round((lostSoFar / totalToLose) * 100));
              remaining = Math.max(0, current - target);
              isAchieved = current <= target;
            } else {
              percent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
              remaining = Math.max(0, goal.targetValue - goal.currentValue);
              isAchieved = goal.currentValue >= goal.targetValue;
            }

            const linkedHabitsList = habits.filter(h => h.linkedGoalId === goal.id && !h.isArchived);
            const internalHabits = goal.internalHabits || [];
            const progressLogs = goal.progressLogs || [];
            const isLogsExpanded = expandedLogsGoalId === goal.id;

            return (
              <div
                key={goal.id}
                className={`bg-slate-900/80 border rounded-2xl p-4 shadow-sm space-y-3.5 transition-all ${
                  isAchieved
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-slate-700/80 hover:border-slate-600'
                }`}
              >
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isDecrease ? (
                        <Scale className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <h4 className="text-sm font-bold text-slate-100 truncate">{goal.title}</h4>
                      {isAchieved && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                          <Award className="w-3 h-3" />
                          Erishildi!
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                        Muddat: {goal.deadline}
                      </span>
                      <span>•</span>
                      <span className={daysLeft > 0 ? 'text-amber-400' : 'text-rose-400'}>
                        {daysLeft > 0 ? `${daysLeft} kun qoldi` : 'Muddat yetib keldi'}
                      </span>
                    </div>

                    {goal.notes && (
                      <p className="text-[11px] text-slate-400 mt-1 bg-slate-800/40 px-2 py-1 rounded-md border border-slate-800 inline-block">
                        💡 {goal.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {goal.isArchived ? (
                      <>
                        <button
                          onClick={() => restoreGoal(goal.id)}
                          className="text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 px-2.5 py-1 rounded-lg border border-sky-500/30 flex items-center gap-1 transition-colors"
                          title="Qayta tiklash"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Tiklash</span>
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Ushbu maqsadni butunlay o'chirasizmi?")) {
                              deleteGoal(goal.id, true);
                            }
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
                          title="Butunlay o'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(goal)}
                          className="text-slate-400 hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                          title="O'zgartirish / Tahrirlash"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id, false)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Arxivga o'tkazish (saqlanib qoladi)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* COUNTDOWN & REMAINING CARD (User Request: 300 - 30 = 270 qoldi) */}
                <div className="bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/60 border border-sky-500/30 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider block">
                      {isDecrease ? 'Ozish / Kamaytirish qoldig\'i:' : 'Maqsadga erishish qoldig\'i:'}
                    </span>
                    <div className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      {isAchieved ? (
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                          <Award className="w-5 h-5 text-amber-400" />
                          Maqsadga to'liq erishildi! 🎉
                        </span>
                      ) : isDecrease ? (
                        <>
                          <span className="text-rose-400 font-black">{remaining.toFixed(1)} {goal.unit}</span>
                          <span className="text-slate-300 text-xs font-normal">
                            kamaytirish qoldi ({goal.currentValue} {goal.unit} → {goal.targetValue} {goal.unit})
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sky-400 font-black">{remaining} {goal.unit}</span>
                          <span className="text-slate-300 text-xs font-normal">
                            bajarilishi qoldi ({goal.targetValue} - {goal.currentValue} = {remaining})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Joriy holat:</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-400">
                      {goal.currentValue} / {goal.targetValue} {goal.unit} ({percent}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAchieved
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : isDecrease
                        ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500'
                        : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* GOAL-INTERNAL HABITS / SUB-HABITS (User Request: 90kg -> 85kg ichida alohida odatlar) */}
                <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5 text-amber-400" />
                      Maqsad uchun alohida odatlar & rutinalar ({internalHabits.length})
                    </span>
                    {!goal.isArchived && (
                      <button
                        onClick={() =>
                          setActiveGoalForHabitAdd(
                            activeGoalForHabitAdd === goal.id ? null : goal.id
                          )
                        }
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Odat qo'shish</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Form to add internal habit */}
                  {activeGoalForHabitAdd === goal.id && (
                    <form
                      onSubmit={e => handleAddInternalHabitSubmit(goal.id, e)}
                      className="bg-slate-900/90 p-2.5 rounded-xl border border-sky-500/40 space-y-2 animate-in fade-in"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={internalHabitTitle}
                          onChange={e => setInternalHabitTitle(e.target.value)}
                          placeholder="Masalan: Haftada 3 kun zal, 5g kreatin..."
                          required
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <select
                          value={internalHabitFreq}
                          onChange={e => setInternalHabitFreq(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value="Har kuni">Har kuni</option>
                          <option value="Haftada 3 kun">Haftada 3 kun</option>
                          <option value="Har kuni ertalab (Nahorga)">Har kuni ertalab (Nahorga)</option>
                          <option value="Kechqurun">Kechqurun</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveGoalForHabitAdd(null)}
                          className="px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-lg text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                        >
                          Qo'shish
                        </button>
                      </div>
                    </form>
                  )}

                  {internalHabits.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Hozircha ichki odatlar kiritilmagan. Maqsadga erishish uchun kichik kundalik odatlarni belgilang (masalan: zalga chiqish, kreatin, nahorga suv).
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {internalHabits.map(ih => (
                        <div
                          key={ih.id}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                            ih.completedToday
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <button
                            onClick={() => toggleGoalInternalHabit(goal.id, ih.id)}
                            className="flex items-center gap-2 text-left flex-1 min-w-0"
                          >
                            {ih.completedToday ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className={`truncate block font-medium ${ih.completedToday ? 'line-through text-slate-400' : ''}`}>
                                {ih.title}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {ih.targetFrequency ? `${ih.targetFrequency} • ` : ''}Jami {ih.totalCompletions ?? Object.keys(ih.history || {}).filter(d => ih.history?.[d]?.completed && d <= todayStr).length} kun bajarilgan
                              </span>
                            </div>
                          </button>
                          {!goal.isArchived && (
                            <button
                              onClick={() => deleteGoalInternalHabit(goal.id, ih.id)}
                              className="text-slate-600 hover:text-rose-400 p-1 rounded transition-colors"
                              title="O'chirish"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons: Log Progress and View Logs */}
                {!goal.isArchived && (
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() =>
                        setExpandedLogsGoalId(isLogsExpanded ? null : goal.id)
                      }
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
                    >
                      <span>Oxirgi qaydlar va tarix ({progressLogs.length})</span>
                      {isLogsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGoalIdForLog(goal.id);
                        setLogAmount(isDecrease ? 1 : 30);
                        setLogNote('');
                      }}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isDecrease ? "+ Vazn o'lchovi kiritish" : "+ Aniq natija kiritish"}</span>
                    </button>
                  </div>
                )}

                {/* Progress Logs History Accordion (User Request: Xato yozilsa bekor qilish) */}
                {isLogsExpanded && (
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                      <span className="font-semibold text-slate-300">Bajarilgan ishlar jurnali:</span>
                      <span>Xato kiritilsa bekor qilishingiz mumkin</span>
                    </div>

                    {progressLogs.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-2 text-center">
                        Hozircha natija qaydlari mavjud emas.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {progressLogs.map(log => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800/70 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sky-400">
                                  {isDecrease ? `-${log.amount}` : `+${log.amount}`} {goal.unit}
                                </span>
                                {log.note && (
                                  <span className="text-slate-300 truncate">
                                    "{log.note}"
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {log.date} {log.time ? `• ${log.time}` : ''} • Qoldiq: {log.resultingRemaining} {goal.unit}
                              </span>
                            </div>

                            {!goal.isArchived && (
                              <button
                                onClick={() => {
                                  if (window.confirm("Ushbu qaydni bekor qilasizmi? Maqsaddan qaytarib olinadi.")) {
                                    deleteGoalProgressLog(goal.id, log.id);
                                  }
                                }}
                                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors ml-2"
                                title="Qaydni bekor qilish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Quantity Log Modal with note and preview */}
      {selectedGoalIdForLog && (() => {
        const targetGoal = goals.find(g => g.id === selectedGoalIdForLog);
        if (!targetGoal) return null;
        const isDec = targetGoal.goalType === 'decrease';

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Maqsadga aniq natija qo'shish</h3>
                  <p className="text-[11px] text-slate-400 truncate">{targetGoal.title}</p>
                </div>
                <button
                  onClick={() => setSelectedGoalIdForLog(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyLog} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {isDec ? `Vazn kamayishi (${targetGoal.unit})` : `Bajarilgan miqdor (${targetGoal.unit})`} *
                  </label>
                  <input
                    type="number"
                    step={isDec ? '0.1' : '1'}
                    value={logAmount}
                    onChange={e => setLogAmount(Number(e.target.value))}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  {(isDec ? [0.5, 1, 1.5, 2] : [10, 20, 30, 50]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLogAmount(v)}
                      className="flex-1 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      +{v}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Izoh / Aniq kitob yoki mashq nomi (Ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={logNote}
                    onChange={e => setLogNote(e.target.value)}
                    placeholder={
                      isDec
                        ? "Haftalik o'lchov yoki izoh..."
                        : "Izoh yoki bajarilgan ish nomi..."
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Bu faqat ushbu maqsadga qo'shiladi. Boshqa kitob yoki odatlaringizga aralashmaydi.
                  </p>
                </div>

                {/* Live Preview of Calculation */}
                <div className="bg-sky-950/40 p-2.5 rounded-xl border border-sky-500/30 text-xs space-y-1">
                  <span className="font-semibold text-sky-300 block text-[11px]">Qoldiq hisobi:</span>
                  <div className="text-slate-200">
                    {isDec ? (
                      <>
                        Hozirgi: {targetGoal.currentValue} {targetGoal.unit} → Yangi: {(targetGoal.currentValue - logAmount).toFixed(1)} {targetGoal.unit}
                        <br />
                        <span className="text-emerald-400 font-bold">
                          Qoldiq: {Math.max(0, targetGoal.currentValue - logAmount - targetGoal.targetValue).toFixed(1)} {targetGoal.unit}
                        </span>
                      </>
                    ) : (
                      <>
                        {targetGoal.targetValue} - ({targetGoal.currentValue} + {logAmount}) ={' '}
                        <span className="text-emerald-400 font-bold">
                          {Math.max(0, targetGoal.targetValue - (targetGoal.currentValue + logAmount))} {targetGoal.unit} qoladi
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGoalIdForLog(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded-xl"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2 rounded-xl shadow-md active:scale-95"
                  >
                    Saqlash
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Add Goal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100">Yangi Maqsad Belgilash</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3.5">
              {/* Goal Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Maqsad turi *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('reach');
                      setUnit('');
                      setTargetValue(100);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      goalType === 'reach'
                        ? 'bg-sky-600/20 border-sky-500 text-sky-200 font-semibold shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block font-bold">Natijaga erishish</span>
                    <span className="text-[10px] text-slate-400">Belgilangan songa oshib borish</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('decrease');
                      setUnit('kg');
                      setStartValue(90);
                      setTargetValue(80);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      goalType === 'decrease'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-200 font-semibold shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block font-bold">Kamaytirish / Tushirish</span>
                    <span className="text-[10px] text-slate-400">Ko'rsatkichni kamaytirib borish</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Maqsad nomi *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Maqsad nomini kiriting..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {goalType === 'decrease' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Boshlang'ich
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={startValue}
                      onChange={e => setStartValue(Number(e.target.value))}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Kutilayotgan
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={targetValue}
                      onChange={e => setTargetValue(Number(e.target.value))}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Birlik
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Umumiy hajm (Son) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={targetValue}
                      onChange={e => setTargetValue(Number(e.target.value))}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Birlik *
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      placeholder="bet, marta, km, soat"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tugash muddati (Deadline) *
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Qaydlar (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Izoh yoki eslatmalar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2.5 rounded-xl border border-slate-700"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md active:scale-95"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Maqsadni Tahrirlash</h3>
                  <p className="text-[11px] text-slate-400">Maqsad nomi, marrasi, joriy ko'rsatkichi yoki muddatini o'zgartirish</p>
                </div>
              </div>
              <button
                onClick={() => setEditingGoal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGoal} className="space-y-3.5">
              {/* Goal Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Maqsad yo'nalishi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditGoalType('reach')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      editGoalType === 'reach'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Ortib boruvchi (Kitob, Daromad)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditGoalType('decrease')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      editGoalType === 'decrease'
                        ? 'bg-rose-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Ozish / Kamaytirish (Vazn tashlash)</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Maqsad nomi *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Masalan: 300 bet kitob o'qish"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Targets, Starting and Current Values */}
              {editGoalType === 'decrease' ? (
                <div className="grid grid-cols-3 gap-2 bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl">
                  <div>
                    <label className="block text-[11px] font-medium text-rose-300 mb-1">
                      Boshlang'ich
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editStartValue}
                      onChange={e => setEditStartValue(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-amber-300 mb-1">
                      Hozirgi
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editCurrentValue}
                      onChange={e => setEditCurrentValue(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-300 mb-1">
                      Kutilayotgan
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editTargetValue}
                      onChange={e => setEditTargetValue(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Joriy natija
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editCurrentValue}
                      onChange={e => setEditCurrentValue(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Yakuniy Marra *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editTargetValue}
                      onChange={e => setEditTargetValue(Number(e.target.value))}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Unit & Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Birlik
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    placeholder="bet, kg, $, km"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Oxirgi muddat
                  </label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={e => setEditDeadline(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Qaydlar (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Izoh yoki eslatmalar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2.5 rounded-xl border border-slate-700"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md active:scale-95"
                >
                  O'zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Safe bottom spacer */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
