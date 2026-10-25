import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MiniAppTab } from '../../types';
import { TabBoshSahifa } from './TabBoshSahifa';
import { TabVazifalar } from './TabVazifalar';
import { TabOdatlar } from './TabOdatlar';
import { TabHarajatlar } from './TabHarajatlar';
import { TabMaqsadlar } from './TabMaqsadlar';
import { TabKalendar } from './TabKalendar';
import { TabSozlamalar } from './TabSozlamalar';
import {
  Home,
  CheckSquare,
  Calendar,
  Wallet,
  Target,
} from 'lucide-react';

export const MiniAppContainer: React.FC = () => {
  const { activeTab, setActiveTab, tasks } = useApp();

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAddHabitModalOpen, setIsAddHabitModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);

  // Pending tasks count badge
  const pendingTasksCount = tasks.filter(t => t.status === 'pending' && !t.isArchived).length;

  const tabsConfig = [
    { id: 'bosh_sahifa', label: 'Bosh sahifa', icon: Home },
    { id: 'vazifalar', label: 'Vazifalar', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined },
    { id: 'kalendar', label: 'Kalendar', icon: Calendar },
    { id: 'harajatlar', label: 'Xarajat', icon: Wallet },
    { id: 'maqsadlar', label: 'Maqsad & Odat', icon: Target },
  ];

  return (
    <div className="flex flex-col flex-1 w-full min-h-screen bg-[#090d16] text-slate-100 relative">
      {/* Main Tab Content Area with safe bottom spacing for floating nav */}
      <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 pb-28 sm:pb-32">
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

      {/* Modern Floating Bottom Navigation Bar (Telegram Mobile Standard) */}
      <div className="absolute bottom-2 left-2 right-2 z-30 pointer-events-none">
        <nav className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {tabsConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'maqsadlar' && activeTab === 'odatlar');

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as MiniAppTab)}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative flex-1 min-w-[48px] min-h-[46px] select-none ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'scale-110 text-sky-400' : ''}`} />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-slate-900 shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[58px] ${isActive ? 'text-sky-300 font-bold' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
