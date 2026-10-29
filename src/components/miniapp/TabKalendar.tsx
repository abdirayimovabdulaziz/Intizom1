import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateYMD, formatUzbekDateLabel } from '../../utils/uzbekNlp';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const TabKalendar: React.FC = () => {
  const { todayStr, tasks, habits, toggleTaskComplete } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  });

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
  // Adjust so Monday is 0 and Sunday is 6
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

  // Selected date's tasks
  const tasksForSelectedDate = tasks.filter(t => t.date === selectedDate && t.status !== 'cancelled');

  return (
    <div className="space-y-4 pb-6">
      {/* Calendar Header & Month Navigation */}
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
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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

            // Check if day has tasks or habits
            const hasTask = tasks.some(t => t.date === dayStr && t.status !== 'cancelled');
            const hasHabitRecord = habits.some(h => h.history[dayStr]?.completed);

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
                    />
                  )}
                  {hasHabitRecord && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-amber-300' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-sky-400" />
            <h4 className="font-bold text-sm text-slate-100">
              {formatUzbekDateLabel(selectedDate)}
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            {tasksForSelectedDate.length} ta vazifa
          </span>
        </div>

        {tasksForSelectedDate.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Ushbu sanaga vazifalar rejalashtirilmagan.
          </div>
        ) : (
          <div className="space-y-2">
            {tasksForSelectedDate.map(task => {
              const isDone = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-slate-900/40 border-slate-800 text-slate-500'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-100'
                  }`}
                >
                  <button
                    onClick={() => toggleTaskComplete(task.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-sky-400 shrink-0 transition-colors" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isDone ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Safe bottom spacer */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
