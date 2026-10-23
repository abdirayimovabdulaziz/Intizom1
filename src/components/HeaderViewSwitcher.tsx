import React from 'react';
import { useApp } from '../context/AppContext';
import { Bot, Smartphone, Columns2, Bell, Sparkles } from 'lucide-react';

export const HeaderViewSwitcher: React.FC = () => {
  const { displayMode, setDisplayMode, triggerSimulatedReminder, settings } = useApp();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* App Title & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">Kunlik Yordamchi</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Telegram AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Vazifalar, odatlar va maqsadlar shaxsiy yordamchisi • {settings.timezone}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & Quick Reminder Test */}
        <div className="flex items-center gap-2">
          {/* Quick test reminder */}
          <button
            onClick={() => triggerSimulatedReminder()}
            title="Eslatma bildirishnomasini simulyatsiya qilish"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all shadow-sm active:scale-95"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Eslatmani sinash</span>
          </button>

          {/* Mode Switcher */}
          <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setDisplayMode('miniapp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                displayMode === 'miniapp'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mini App</span>
            </button>

            <button
              onClick={() => setDisplayMode('bot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                displayMode === 'bot'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Telegram Bot</span>
            </button>

            <button
              onClick={() => setDisplayMode('split')}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                displayMode === 'split'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Yonma-yon</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
