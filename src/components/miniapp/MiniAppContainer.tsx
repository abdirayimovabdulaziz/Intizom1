import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MiniAppTab } from '../../types';
import { TabBoshSahifa } from './TabBoshSahifa';
import { TabVazifalar } from './TabVazifalar';
import { TabHarajatlar } from './TabHarajatlar';
import { TabMaqsadlar } from './TabMaqsadlar';
import { TabKalendar } from './TabKalendar';
import { TabSozlamalar } from './TabSozlamalar';
import { triggerHaptic } from '../../utils/telegram';
import {
  Home,
  CheckSquare,
  Calendar,
  Wallet,
  Target,
} from 'lucide-react';

export const MiniAppContainer: React.FC = () => {
  const { activeTab, setActiveTab, tasks, settings } = useApp();

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAddHabitModalOpen, setIsAddHabitModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);

  // Pending tasks count badge
  const pendingTasksCount = tasks.filter(t => t.status === 'pending' && !t.isArchived).length;

  const tabsConfig: Array<{
    id: MiniAppTab;
    label: string;
    fullLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'bosh_sahifa', label: 'Asosiy', fullLabel: 'Asosiy sahifa', icon: Home },
    { id: 'vazifalar', label: 'Vazifalar', fullLabel: 'Vazifalar ro\'yxati', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined },
    { id: 'kalendar', label: 'Kalendar', fullLabel: 'Kalendar va faoliyatlar', icon: Calendar },
    { id: 'harajatlar', label: 'Xarajat', fullLabel: 'Xarajatlar hisobi', icon: Wallet },
    { id: 'maqsadlar', label: 'Maqsadlar', fullLabel: 'Maqsadlar va odatlar', icon: Target },
  ];

  const handleTabSelect = (tabId: MiniAppTab) => {
    if (tabId !== activeTab) {
      triggerHaptic('selection', settings.reminderSound);
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full h-full bg-[#090d16] text-slate-100 relative overflow-hidden">
      {/* Main Tab Content Area with safe bottom spacing for floating nav */}
      <div
        style={{
          paddingBottom: 'calc(var(--tg-safe-bottom, 0px) + 5.5rem)',
        }}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 sm:px-5 overscroll-contain"
      >
        {activeTab === 'bosh_sahifa' && (
          <TabBoshSahifa
            onOpenAddTask={() => {
              setActiveTab('vazifalar');
              setIsAddTaskModalOpen(true);
            }}
            onOpenAddHabit={() => {
              setActiveTab('maqsadlar');
              setIsAddHabitModalOpen(true);
            }}
            onOpenAddExpense={() => {
              setActiveTab('harajatlar');
              setIsAddExpenseModalOpen(true);
            }}
          />
        )}
        {activeTab === 'vazifalar' && (
          <TabVazifalar
            isAddModalOpen={isAddTaskModalOpen}
            setIsAddModalOpen={setIsAddTaskModalOpen}
          />
        )}
        {activeTab === 'kalendar' && <TabKalendar />}
        {activeTab === 'harajatlar' && (
          <TabHarajatlar
            isAddModalOpen={isAddExpenseModalOpen}
            setIsAddModalOpen={setIsAddExpenseModalOpen}
          />
        )}
        {(activeTab === 'maqsadlar' || activeTab === 'odatlar') && (
          <TabMaqsadlar
            isAddModalOpen={isAddGoalModalOpen}
            setIsAddModalOpen={setIsAddGoalModalOpen}
            defaultSubTab={activeTab === 'odatlar' ? 'odatlar' : 'maqsadlar'}
            isAddHabitModalOpen={isAddHabitModalOpen}
            setIsAddHabitModalOpen={setIsAddHabitModalOpen}
          />
        )}
        {activeTab === 'sozlamalar' && <TabSozlamalar />}
      </div>

      {/* Floating Bottom Navigation Bar (Telegram Mobile Standard) */}
      <div
        style={{
          paddingBottom: 'max(0.35rem, calc(var(--tg-safe-bottom, 0px) + 0.25rem))',
        }}
        className="absolute bottom-0 left-0 right-0 z-30 px-2 sm:px-3 pointer-events-none"
      >
        <nav
          aria-label="Ilova navigatsiyasi"
          className="pointer-events-auto max-w-xl mx-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-1 shadow-2xl flex items-center justify-between gap-0.5"
        >
          {tabsConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'maqsadlar' && activeTab === 'odatlar');
            const badgeLabel = tab.badge !== undefined
              ? (tab.badge > 99 ? '99+' : String(tab.badge))
              : null;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSelect(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${tab.fullLabel}${badgeLabel ? `, ${badgeLabel} ta yangi` : ''}`}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative flex-1 min-w-[44px] min-h-[44px] select-none focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'scale-110 text-sky-400' : ''}`} />
                  {badgeLabel && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border-2 border-slate-900 shadow-sm leading-none"
                    >
                      {badgeLabel}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[58px] ${isActive ? 'text-sky-300 font-bold' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-0.5 -mb-1" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
