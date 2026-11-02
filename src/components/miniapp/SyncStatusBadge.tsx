import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { useSyncContext } from '../../context/SyncContext';

export const SyncStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    syncStatus,
    cloudRevision,
    user,
    isLiveDatabase,
    triggerSyncNow,
    isConflictModalOpen: _isConflictModalOpen,
  } = useSyncContext();

  const getStatusDisplay = () => {
    switch (syncStatus) {
      case 'saving':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />,
          label: 'Saqlanmoqda...',
          bgColor: 'bg-sky-950/40 border-sky-500/30 text-sky-300',
        };
      case 'idle':
        return {
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
          label: cloudRevision ? `Bulutda saqlandi (v${cloudRevision})` : 'Bulutda saqlandi',
          bgColor: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300',
        };
      case 'offline':
        return {
          icon: <CloudOff className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Internet yo‘q — qurilmada saqlandi',
          bgColor: 'bg-amber-950/40 border-amber-500/30 text-amber-300',
        };
      case 'conflict':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />,
          label: 'Sinxronizatsiyada ziddiyat',
          bgColor: 'bg-rose-950/40 border-rose-500/40 text-rose-300',
        };
      case 'unmigrated':
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-sky-400" />,
          label: 'Bulutga ko‘chirish kutilmoqda',
          bgColor: 'bg-sky-950/40 border-sky-500/30 text-sky-300',
        };
      case 'auth_required':
      default:
        return {
          icon: <Cloud className="w-3.5 h-3.5 text-slate-400" />,
          label: 'Lokal rejim',
          bgColor: 'bg-slate-800/60 border-slate-700/50 text-slate-400',
        };
    }
  };

  const status = getStatusDisplay();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => triggerSyncNow()}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${status.bgColor}`}
        title={`${status.label} • Bosish orqali yangilash`}
      >
        {status.icon}
        <span className="hidden sm:inline">{status.label}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg border ${status.bgColor}`}>{status.icon}</div>
        <div>
          <div className="font-medium text-slate-200">{status.label}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Database className="w-3 h-3 text-slate-500" />
            <span>
              {isLiveDatabase ? 'Supabase PostgreSQL' : 'Lokal / In-Memory'} •{' '}
              {user ? (user.isDemo ? 'Demo rejim' : `@${user.username || user.firstName || user.id}`) : 'Ulanmagan'}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => triggerSyncNow()}
        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 transition-all flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Yangilash</span>
      </button>
    </div>
  );
};
