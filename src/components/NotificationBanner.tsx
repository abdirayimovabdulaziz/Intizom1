import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCircle, Clock, X } from 'lucide-react';

export const NotificationBanner: React.FC = () => {
  const { activeNotification, dismissNotification, postponeTask, toggleTaskComplete } = useApp();

  useEffect(() => {
    if (activeNotification) {
      // Auto dismiss after 8 seconds if not interacted
      const timer = setTimeout(() => {
        dismissNotification();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activeNotification, dismissNotification]);

  if (!activeNotification) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top duration-300">
      <div className="bg-slate-900/95 text-white backdrop-blur-md border border-sky-500/40 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Telegram Eslatma
                </span>
                <span className="text-xs text-slate-400">Hozir</span>
              </div>
              <h4 className="font-semibold text-sm text-slate-100 mt-0.5">{activeNotification.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5">{activeNotification.body}</p>
            </div>
          </div>
          <button
            onClick={dismissNotification}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={() => {
              if (activeNotification.taskId) {
                toggleTaskComplete(activeNotification.taskId);
              }
              dismissNotification();
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Bajarildi
          </button>
          <button
            onClick={() => {
              if (activeNotification.taskId) {
                postponeTask(activeNotification.taskId, 15);
              }
              dismissNotification();
            }}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            +15 daqiqa
          </button>
        </div>
      </div>
    </div>
  );
};
