import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HabitFrequency, HabitType } from '../../types';
import { formatDateYMD } from '../../utils/uzbekNlp';
import { addDaysToYMD } from '../../utils/domainCalculations';
import {
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Trash2,
  Target,
  X,
  Calendar,
  Pill,
  Clock,
  Repeat,
  Pencil,
} from 'lucide-react';

export const TabOdatlar: React.FC<{
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}> = ({ isAddModalOpen, setIsAddModalOpen }) => {
  const {
    todayStr,
    todayDayOfWeek,
    habits,
    goals,
    toggleHabitToday,
    logHabitQuantity,
    addHabit,
    updateHabit,
    deleteHabit,
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'health' | 'general'>('all');

  // Add Habit Form State
  const [title, setTitle] = useState('');
  const [habitType, setHabitType] = useState<HabitType>('general');
  const [dosage, setDosage] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState<number>(3);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Default Monday
  const [hasQuantity, setHasQuantity] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('marta');
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');

  // Edit Habit Form State
  const [editingHabit, setEditingHabit] = useState<(typeof habits)[0] | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editHabitType, setEditHabitType] = useState<HabitType>('general');
  const [editDosage, setEditDosage] = useState('');
  const [editTimeSlot, setEditTimeSlot] = useState('');
  const [editFrequency, setEditFrequency] = useState<HabitFrequency>('daily');
  const [editTargetDaysPerWeek, setEditTargetDaysPerWeek] = useState<number>(3);
  const [editSelectedDays, setEditSelectedDays] = useState<number[]>([1]);
  const [editHasQuantity, setEditHasQuantity] = useState(false);
  const [editTargetQuantity, setEditTargetQuantity] = useState<number>(1);
  const [editUnit, setEditUnit] = useState('marta');
  const [editLinkedGoalId, setEditLinkedGoalId] = useState<string>('');

  const openEditModal = (h: (typeof habits)[0]) => {
    setEditingHabit(h);
    setEditTitle(h.title);
    setEditHabitType(h.habitType || 'general');
    setEditDosage(h.dosage || '');
    setEditTimeSlot(h.timeSlot || '');
    setEditFrequency(h.frequency || 'daily');
    setEditTargetDaysPerWeek(h.targetDaysPerWeek || 3);
    setEditSelectedDays(h.daysOfWeek || [1]);
    setEditHasQuantity(!!h.hasQuantity);
    setEditTargetQuantity(h.targetQuantity || 1);
    setEditUnit(h.unit || 'marta');
    setEditLinkedGoalId(h.linkedGoalId || '');
  };

  const handleUpdateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit || !editTitle.trim()) return;

    updateHabit(editingHabit.id, {
      title: editTitle.trim(),
      habitType: editHabitType,
      dosage: editHabitType === 'supplement_health' ? editDosage.trim() : undefined,
      timeSlot: editHabitType === 'supplement_health' ? editTimeSlot.trim() : undefined,
      frequency: editFrequency,
      targetDaysPerWeek: editFrequency === 'weekly_target' ? Math.max(1, Math.min(7, Math.round(Number(editTargetDaysPerWeek) || 3))) : undefined,
      daysOfWeek: editFrequency === 'specific_days' ? editSelectedDays : undefined,
      hasQuantity: editHasQuantity,
      targetQuantity: editHasQuantity ? Number(editTargetQuantity) || 1 : undefined,
      unit: editHasQuantity ? editUnit : undefined,
      linkedGoalId: editLinkedGoalId || undefined,
    });

    setEditingHabit(null);
  };

  const toggleEditDay = (dayNum: number) => {
    setEditSelectedDays(prev =>
      prev.includes(dayNum) ? (prev.length > 1 ? prev.filter(d => d !== dayNum) : prev) : [...prev, dayNum].sort()
    );
  };

  const daysLabels = [
    { num: 1, label: 'Du' },
    { num: 2, label: 'Se' },
    { num: 3, label: 'Chor' },
    { num: 4, label: 'Pay' },
    { num: 5, label: 'Jum' },
    { num: 6, label: 'Shan' },
    { num: 7, label: 'Yak' },
  ];

  const toggleDaySelection = (dayNum: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev; // Keep at least one day selected
        return prev.filter(d => d !== dayNum);
      } else {
        return [...prev, dayNum].sort();
      }
    });
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalDays: number[] = [1, 2, 3, 4, 5, 6, 7];
    if (frequency === 'specific_days') {
      finalDays = selectedDays.length > 0 ? selectedDays : [1];
    } else if (frequency === 'weekly_target') {
      finalDays = [];
    }

    addHabit({
      title: title.trim(),
      category: 'odat',
      habitType,
      dosage: habitType === 'supplement_health' && dosage.trim() ? dosage.trim() : undefined,
      timeSlot: habitType === 'supplement_health' && timeSlot.trim() ? timeSlot.trim() : undefined,
      frequency,
      targetDaysPerWeek: frequency === 'weekly_target' ? Math.max(1, Math.min(7, Math.round(Number(targetDaysPerWeek) || 3))) : undefined,
      daysOfWeek: finalDays,
      hasQuantity,
      targetQuantity: hasQuantity ? Number(targetQuantity) : undefined,
      unit: hasQuantity && unit.trim() ? unit.trim() : undefined,
      linkedGoalId: linkedGoalId || undefined,
    });

    // Reset Form
    setTitle('');
    setDosage('');
    setTimeSlot('');
    setFrequency('daily');
    setTargetDaysPerWeek(3);
    setSelectedDays([1]);
    setHasQuantity(false);
    setTargetQuantity(1);
    setUnit('marta');
    setLinkedGoalId('');
    setIsAddModalOpen(false);
  };

  // Generate last 7 days keys for weekly matrix
  const getLast7Days = () => {
    const list: string[] = [];
    for (let i = 6; i >= 0; i--) {
      list.push(addDaysToYMD(todayStr, -i));
    }
    return list;
  };
  const last7Days = getLast7Days();

  const filteredHabits = habits.filter(h => {
    if (h.isArchived) return false;
    if (filterType === 'health') return h.habitType === 'supplement_health';
    if (filterType === 'general') return h.habitType !== 'supplement_health';
    return true;
  });

  const getFrequencyLabel = (habit: typeof habits[0]) => {
    if (habit.frequency === 'daily') return 'Har kuni';
    if (habit.frequency === 'weekly_target') return `Haftada ${habit.targetDaysPerWeek || 3} marta`;
    if (habit.frequency === 'specific_days') {
      if (habit.daysOfWeek?.length === 1 && habit.daysOfWeek[0] === 1) {
        return 'Har dushanba kuni';
      }
      const dayNames = (habit.daysOfWeek || [])
        .map(d => daysLabels.find(l => l.num === d)?.label)
        .filter(Boolean)
        .join(', ');
      return dayNames ? `Haftaning: ${dayNames}` : 'Muayyan kunlarda';
    }
    return 'Muntazam';
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Odatlar</h2>
          <p className="text-xs text-slate-400">Kunlik va haftalik muntazam intizom</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi odat</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => setFilterType('all')}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
            filterType === 'all'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          Barchasi ({habits.filter(h => !h.isArchived).length})
        </button>
        <button
          onClick={() => setFilterType('health')}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
            filterType === 'health'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          Salomatlik
        </button>
        <button
          onClick={() => setFilterType('general')}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
            filterType === 'general'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          Umumiy odatlar
        </button>
      </div>

      {/* Habits List */}
      <div className="space-y-3">
        {filteredHabits.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="text-slate-300 font-semibold">Hozircha odatlar mavjud emas</p>
            <p className="text-slate-400 text-[11px]">
              Har kungi yoki haftaning ma'lum kunlaridagi muntazam odatlaringizni kiriting!
            </p>
            <div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Birinchi odatni qo'shish</span>
              </button>
            </div>
          </div>
        ) : (
          filteredHabits.map(habit => {
            const todayRecord = habit.history[todayStr] || { completed: false, quantity: 0 };
            const isDone = todayRecord.completed;
            const linkedGoal = goals.find(g => g.id === habit.linkedGoalId);
            const isHealth = habit.habitType === 'supplement_health';

            return (
              <div
                key={habit.id}
                className={`bg-slate-900/80 border rounded-2xl p-4 shadow-sm hover:border-slate-600 transition-all space-y-3 ${
                  isHealth ? 'border-emerald-500/30' : 'border-slate-700/80'
                }`}
              >
                {/* Habit Header & Checkbox */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleHabitToday(habit.id)}
                      className="mt-0.5 shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-500 hover:text-sky-400 transition-colors" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-sm font-semibold truncate ${
                            isDone ? 'text-slate-400' : 'text-slate-100'
                          }`}
                        >
                          {habit.title}
                        </h4>
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          <Flame className="w-3.5 h-3.5 fill-amber-400" />
                          {habit.frequency === 'weekly_target' ? `${habit.streak} hafta` : `${habit.streak} kun`}
                        </span>
                      </div>

                      {/* Frequency Badge */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1 text-[11px] font-medium">
                          <Repeat className="w-3 h-3 text-sky-400" />
                          {getFrequencyLabel(habit)}
                        </span>

                        {habit.frequency === 'weekly_target' && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-medium border border-indigo-500/25 flex items-center gap-1 text-[11px]">
                            Bu hafta: {habit.weeklyCompletions ?? 0}/{Math.max(1, Math.min(7, habit.targetDaysPerWeek || 3))} kun
                          </span>
                        )}

                        {isHealth && habit.dosage && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/25 flex items-center gap-1 text-[11px]">
                            <Pill className="w-3 h-3" />
                            {habit.dosage}
                          </span>
                        )}

                        {isHealth && habit.timeSlot && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {habit.timeSlot}
                          </span>
                        )}
                      </div>

                      {/* Linked Goal Badge */}
                      {linkedGoal && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md mt-1.5 font-medium">
                          <Target className="w-3 h-3" />
                          <span>Maqsad: {linkedGoal.title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(habit)}
                      className="text-slate-400 hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="O'zgartirish / Tahrirlash"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quantity Logger */}
                {habit.hasQuantity && habit.targetQuantity && (
                  <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-200">Bugungi miqdor:</span>
                        <span className="text-emerald-400 font-bold">
                          {todayRecord.quantity || 0} / {habit.targetQuantity} {habit.unit}
                        </span>
                      </div>
                      <div className="w-32 sm:w-44 bg-slate-900 rounded-full h-1.5 overflow-hidden mt-1.5">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(((todayRecord.quantity || 0) / habit.targetQuantity) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => logHabitQuantity(habit.id, -1)}
                        className="px-2 py-1 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        title="-1"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => logHabitQuantity(habit.id, 1)}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                        title="+1"
                      >
                        +1 {habit.unit}
                      </button>
                    </div>
                  </div>
                )}

                {/* Last 7 Days Mini Dot Grid */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Oxirgi 7 kun:</span>
                  <div className="flex items-center gap-1.5">
                    {last7Days.map(dateKey => {
                      const dayRec = habit.history[dateKey];
                      const dayDone = dayRec?.completed;
                      const [,, d] = dateKey.split('-');

                      return (
                        <div
                          key={dateKey}
                          title={`${dateKey}: ${dayDone ? 'Bajarilgan' : 'Bajarilmagan'}`}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-medium transition-all ${
                            dayDone
                              ? 'bg-emerald-500 text-white font-bold'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {parseInt(d, 10)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Habit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100">Yangi Odat Qo'shish</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHabit} className="space-y-3.5">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Odat toifasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHabitType('general')}
                    className={`py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                      habitType === 'general'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Umumiy odat
                  </button>
                  <button
                    type="button"
                    onClick={() => setHabitType('supplement_health')}
                    className={`py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                      habitType === 'supplement_health'
                        ? 'bg-emerald-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    Salomatlik
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nomi *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Odat nomini kiriting..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Frequency Selector: Har kuni, Haftada N marta, Hafta kunlari */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Takrorlanish chastotasi *
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition-all ${
                      frequency === 'daily'
                        ? 'bg-sky-600 text-white border-transparent shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    Har kuni
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('weekly_target')}
                    className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition-all ${
                      frequency === 'weekly_target'
                        ? 'bg-sky-600 text-white border-transparent shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    Haftada N marta
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('specific_days')}
                    className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition-all ${
                      frequency === 'specific_days'
                        ? 'bg-sky-600 text-white border-transparent shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    Hafta kunlari
                  </button>
                </div>

                {/* Sub-options for weekly_target */}
                {frequency === 'weekly_target' && (
                  <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/70 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Haftasiga necha marta?</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTargetDaysPerWeek(num)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            targetDaysPerWeek === num
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-options for specific_days (e.g. Faqat har dushanba) */}
                {frequency === 'specific_days' && (
                  <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">Qaysi kunlarda bajariladi?</span>
                      {selectedDays.length === 1 && selectedDays[0] === 1 && (
                        <span className="text-[11px] text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                          Faqat har dushanba
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {daysLabels.map(d => {
                        const isSel = selectedDays.includes(d.num);
                        return (
                          <button
                            key={d.num}
                            type="button"
                            onClick={() => toggleDaySelection(d.num)}
                            className={`py-2 text-[11px] font-semibold rounded-lg border transition-all ${
                              isSel
                                ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Supplement specific fields (Only if Salomatlik is chosen) */}
              {habitType === 'supplement_health' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Miqdor / Doza
                    </label>
                    <input
                      type="text"
                      value={dosage}
                      onChange={e => setDosage(e.target.value)}
                      placeholder="Miqdor (masalan: 1 tabletka)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Qabul vaqti
                    </label>
                    <select
                      value={timeSlot}
                      onChange={e => setTimeSlot(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Tanlang...</option>
                      <option value="Ertalab nahorga">Ertalab nahorga</option>
                      <option value="Kun davomida">Kun davomida</option>
                      <option value="Ovqatdan oldin">Ovqatdan oldin</option>
                      <option value="Ovqatdan keyin">Ovqatdan keyin</option>
                      <option value="Kechqurun yotishdan oldin">Kechqurun yotishdan oldin</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Quantity Tracking Toggle */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-200">
                      Raqam bilan hisoblash
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Miqdor va o'lchov birligini belgilash
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasQuantity}
                    onChange={e => setHasQuantity(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 accent-sky-500 cursor-pointer"
                  />
                </div>

                {hasQuantity && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Kunlik maqsad (son)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={targetQuantity}
                        onChange={e => setTargetQuantity(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
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
                        placeholder="marta, sahifa, daqiqa"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Link to Goal Selector */}
              {goals.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Katta Maqsadga bog'lash (Ixtiyoriy)
                  </label>
                  <select
                    value={linkedGoalId}
                    onChange={e => setLinkedGoalId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Bog'lanmagan</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* Edit Habit Modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Odatni Tahrirlash</h3>
                  <p className="text-[11px] text-slate-400">Odat nomi, davriyligi va maqsadlarini o'zgartirish</p>
                </div>
              </div>
              <button
                onClick={() => setEditingHabit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHabit} className="space-y-3.5">
              {/* Habit Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Odat turi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditHabitType('general')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      editHabitType === 'general'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Umumiy Odat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditHabitType('supplement_health')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      editHabitType === 'supplement_health'
                        ? 'bg-emerald-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>Salomatlik / Qabul</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Odat nomi *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Masalan: Kitob o'qish yoki 5g kreatin"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Health supplement fields */}
              {editHabitType === 'supplement_health' && (
                <div className="grid grid-cols-2 gap-3 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-emerald-300 mb-1">
                      Doza (Miqdor)
                    </label>
                    <input
                      type="text"
                      value={editDosage}
                      onChange={e => setEditDosage(e.target.value)}
                      placeholder="Masalan: 5 gr, 1 tabletka"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-emerald-300 mb-1">
                      Qabul vaqti
                    </label>
                    <input
                      type="text"
                      value={editTimeSlot}
                      onChange={e => setEditTimeSlot(e.target.value)}
                      placeholder="Masalan: Ertalab och qoringa"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Frequency Section */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Davriylik</label>
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setEditFrequency('daily')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-medium border text-center transition-all ${
                      editFrequency === 'daily'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Har kuni
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFrequency('weekly_target')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-medium border text-center transition-all ${
                      editFrequency === 'weekly_target'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Haftada X marta
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFrequency('specific_days')}
                    className={`py-2 px-1.5 rounded-xl text-xs font-medium border text-center transition-all ${
                      editFrequency === 'specific_days'
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Muayyan kunlar
                  </button>
                </div>

                {/* Specific days selector */}
                {editFrequency === 'specific_days' && (
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 mb-2">
                    <span className="text-[11px] text-slate-400 block mb-1.5">Hafta kunlarini belgilang:</span>
                    <div className="grid grid-cols-7 gap-1">
                      {daysLabels.map(d => {
                        const isSelected = editSelectedDays.includes(d.num);
                        return (
                          <button
                            key={d.num}
                            type="button"
                            onClick={() => toggleEditDay(d.num)}
                            className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Weekly target number */}
                {editFrequency === 'weekly_target' && (
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs text-slate-300">Haftada necha marta?</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setEditTargetDaysPerWeek(num)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors ${
                            editTargetDaysPerWeek === num
                              ? 'bg-sky-600 text-white border-sky-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity Target Toggle */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasQuantity}
                    onChange={e => setEditHasQuantity(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 bg-slate-800 border-slate-700 focus:ring-0"
                  />
                  <span>Kunlik miqdorni o'lchash (Masalan: 20 bet, 2 litr)</span>
                </label>
              </div>

              {editHasQuantity && (
                <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Kunlik reja miqdori
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editTargetQuantity}
                      onChange={e => setEditTargetQuantity(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      O'lchov birligi
                    </label>
                    <input
                      type="text"
                      value={editUnit}
                      onChange={e => setEditUnit(e.target.value)}
                      placeholder="bet, litr, km, marta"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* Linked Goal */}
              {goals.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Katta Maqsadga bog'lash (Ixtiyoriy)
                  </label>
                  <select
                    value={editLinkedGoalId}
                    onChange={e => setEditLinkedGoalId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Bog'lanmagan</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingHabit(null)}
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
    </div>
  );
};
