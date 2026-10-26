import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, TaskPriority } from '../../types';
import {
  formatDateYMD,
  formatUzbekDateLabel,
} from '../../utils/uzbekNlp';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Trash2,
  MoreVertical,
  Calendar,
  AlertCircle,
  X,
  Sparkles,
  CheckSquare,
  Flame,
  Repeat,
  ChevronRight,
  Pill,
  Pencil,
} from 'lucide-react';
export const TabVazifalar: React.FC<{
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}> = ({ isAddModalOpen, setIsAddModalOpen }) => {
  const {
    tasks,
    habits,
    toggleHabitToday,
    addTask,
    updateTask,
    toggleTaskComplete,
    postponeTask,
    deleteTask,
    setActiveTab,
  } = useApp();

  const [filter, setFilter] = useState<'bugun' | 'kelgusi' | 'bajarilgan' | 'hammasi'>('bugun');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  // New task form state
  const todayStr = formatDateYMD(new Date());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('15:30');
  const [category, setCategory] = useState<'vazifa' | 'uchrashuv'>('vazifa');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [notes, setNotes] = useState('');

  // Edit task state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState(todayStr);
  const [editTime, setEditTime] = useState('');
  const [editCategory, setEditCategory] = useState<'vazifa' | 'uchrashuv'>('vazifa');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editNotes, setEditNotes] = useState('');

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDate(task.date);
    setEditTime(task.time || '');
    setEditCategory(task.category || 'vazifa');
    setEditPriority(task.priority || 'medium');
    setEditNotes(task.notes || '');
    setActiveMenuTaskId(null);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    updateTask(editingTask.id, {
      title: editTitle.trim(),
      date: editDate,
      time: editTime.trim() || undefined,
      category: editCategory,
      priority: editPriority,
      notes: editNotes.trim() || undefined,
    });

    setEditingTask(null);
  };

  const filteredTasks = tasks.filter(task => {
    // Search query
    if (searchQuery.trim() && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (filter === 'bugun') {
      return task.date === todayStr && task.status !== 'cancelled';
    }
    if (filter === 'kelgusi') {
      return task.date > todayStr && task.status !== 'completed' && task.status !== 'cancelled';
    }
    if (filter === 'bajarilgan') {
      return task.status === 'completed';
    }
    return task.status !== 'cancelled';
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      category,
      date,
      time: time || undefined,
      status: 'pending',
      priority,
      notes: notes.trim() || undefined,
      source: 'miniapp',
    });

    setTitle('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const setDateOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(formatDateYMD(d));
  };

  // Today's active habits calculation
  const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const todayHabits = habits.filter(h => {
    if (h.isArchived) return false;
    if (h.frequency === 'daily') return true;
    return h.daysOfWeek.includes(todayDayOfWeek);
  });
  const completedHabitsCount = todayHabits.filter(h => !!h.history[todayStr]?.completed).length;

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header & Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Bugungi Vazifalar & Odatlar</h2>
          <p className="text-xs text-slate-400">Kunlik ishlar va bugun bajarilishi kerak bo'lgan odatlar</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('kalendar')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs px-2.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border border-slate-700 min-h-[40px]"
            title="Oylik kalendarga o'tish"
          >
            <Calendar className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Kalendar</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi vazifa</span>
          </button>
        </div>
      </div>

      {/* BUGUNGI ODATLAR & QABULLAR (Kreatin, Suv, Mutolaa...) */}
      {todayHabits.length > 0 && (
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                  <span>Bugungi Odatlar</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    {completedHabitsCount}/{todayHabits.length}
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('maqsadlar')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5 transition-colors"
            >
              <span>Odatlar boshqaruvi</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todayHabits.map(habit => {
              const isDone = !!habit.history[todayStr]?.completed;
              return (
                <div
                  key={habit.id}
                  onClick={() => toggleHabitToday(habit.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                    isDone
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800/80 border-slate-700/80 hover:border-emerald-500/30 text-slate-200 active:scale-98'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {habit.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      {habit.dosage && <span className="text-emerald-400 font-medium">{habit.dosage}</span>}
                      {habit.dosage && habit.timeSlot && <span aria-hidden="true">·</span>}
                      {habit.timeSlot && <span className="truncate">{habit.timeSlot}</span>}
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                        <Flame className="w-2.5 h-2.5 fill-amber-400" />
                        {habit.streak} kun
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHabitToday(habit.id);
                    }}
                    className="shrink-0 p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
                    title={isDone ? "Bajarilgan" : "Bajarildi deb belgilash"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-emerald-400 transition-colors" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Vazifalardan qidirish..."
          className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-xs border border-slate-700/80 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {[
          { key: 'bugun', label: 'Bugun' },
          { key: 'kelgusi', label: 'Kelgusi' },
          { key: 'bajarilgan', label: 'Bajarilgan' },
          { key: 'hammasi', label: 'Hammasi' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as any)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
              filter === item.key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="text-slate-300 font-semibold">Hozircha vazifalar mavjud emas</p>
            <p className="text-slate-400 text-[11px]">
              Yangi vazifa qo'shish uchun yuqoridagi tugmadan foydalaning yoki Telegram botga yozing!
            </p>
            <div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Birinchi vazifani qo'shish</span>
              </button>
            </div>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`bg-slate-900/80 border rounded-2xl p-3.5 transition-all relative ${
                  isDone
                    ? 'border-slate-800/80 opacity-60'
                    : 'border-slate-700/80 hover:border-slate-600 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className="mt-0.5 shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500 hover:text-sky-400 transition-colors" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </h4>

                      {task.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.notes}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        {/* Date chip */}
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium flex items-center gap-1 border border-slate-700">
                          <Calendar className="w-3 h-3 text-sky-400" />
                          {formatUzbekDateLabel(task.date, task.time)}
                        </span>

                        {/* Priority */}
                        {task.priority === 'high' && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            Yuqori
                          </span>
                        )}
                        {task.priority === 'medium' && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            O'rtacha
                          </span>
                        )}

                        {/* Category */}
                        {task.category === 'uchrashuv' && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                            Uchrashuv
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Dropdown & Quick Edit Toggle */}
                  <div className="flex items-center gap-1 relative">
                    <button
                      onClick={() => openEditModal(task)}
                      className="text-slate-400 hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="O'zgartirish / Tahrirlash"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() =>
                        setActiveMenuTaskId(activeMenuTaskId === task.id ? null : task.id)
                      }
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuTaskId === task.id && (
                      <div className="absolute right-0 top-8 z-20 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 text-xs">
                        <button
                          onClick={() => openEditModal(task)}
                          className="w-full text-left px-3 py-2 text-sky-300 hover:bg-slate-700 flex items-center gap-2 font-medium"
                        >
                          <Pencil className="w-3.5 h-3.5 text-sky-400" />
                          Tahrirlash / O'zgartirish
                        </button>
                        <div className="border-t border-slate-700/80 my-0.5" />
                        <button
                          onClick={() => {
                            postponeTask(task.id, 15);
                            setActiveMenuTaskId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          +15 daqiqa surish
                        </button>
                        <button
                          onClick={() => {
                            postponeTask(task.id, 60);
                            setActiveMenuTaskId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          +1 soat surish
                        </button>
                        <button
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            postponeTask(task.id, formatDateYMD(d));
                            setActiveMenuTaskId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Calendar className="w-3.5 h-3.5 text-sky-400" />
                          Ertaga o'tkazish
                        </button>
                        <div className="border-t border-slate-700 my-1" />
                        <button
                          onClick={() => {
                            deleteTask(task.id);
                            setActiveMenuTaskId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          O'chirish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100">Yangi Vazifa Qo'shish</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vazifa nomi *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Vazifa nomini kiriting..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Quick Date Buttons */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Sana</label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setDateOffset(0)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      date === todayStr
                        ? 'bg-sky-600 text-white border-transparent'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateOffset(1)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    Ertaga
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateOffset(2)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    Indin
                  </button>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vaqt (Eslatma uchun)
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Toifa</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="vazifa">Vazifa (Topshiriq)</option>
                    <option value="uchrashuv">Uchrashuv</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Muhimlik</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="low">Past</option>
                    <option value="medium">O'rtacha</option>
                    <option value="high">Yuqori</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Izoh (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Qo'shimcha ma'lumotlar..."
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

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Vazifani Tahrirlash</h3>
                  <p className="text-[11px] text-slate-400">Nomini yoki vaqtini to'g'irlash</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3.5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vazifa nomi *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Vazifa nomini kiriting..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Sana</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vaqt (Eslatma uchun)
                </label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Toifa</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="vazifa">Vazifa (Topshiriq)</option>
                    <option value="uchrashuv">Uchrashuv</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Muhimlik</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="low">Past</option>
                    <option value="medium">O'rtacha</option>
                    <option value="high">Yuqori</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Izoh (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Qo'shimcha ma'lumotlar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
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

      {/* Safe bottom spacer */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
