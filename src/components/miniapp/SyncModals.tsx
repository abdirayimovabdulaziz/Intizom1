import React from 'react';
import { AlertTriangle, Cloud, Download, ArrowUpRight, ArrowDownRight, UserX, X } from 'lucide-react';
import { useSyncContext } from '../../context/SyncContext';
import { useApp } from '../../context/AppContext';

export const SyncModals: React.FC = () => {
  const {
    conflictData,
    isConflictModalOpen,
    isMigrationModalOpen,
    isAccountSwitchModalOpen,
    switchedPreviousUser,
    user,
    resolveConflictWithCloud,
    resolveConflictWithLocal,
    confirmMigrationToCloud,
    closeConflictModal,
    closeMigrationModal,
    dismissAccountSwitchNotice,
  } = useSyncContext();

  const { exportAllDataAsJson } = useApp();

  return (
    <>
      {/* 1. CONFLICT RESOLUTION MODAL */}
      {isConflictModalOpen && conflictData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-100">Sinxronizatsiyada Ziddiyat Aniqlandi</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Boshqa qurilmadan yangilanish kiritilgan (Server versiyasi: <b>v{conflictData.currentRevision}</b>).
                  Ushbu qurilmadagi ma'lumotlaringiz xavfsiz saqlanmoqda.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-200">Qaysi versiyani saqlab qolishni xohlaysiz?</div>
              <p className="text-slate-400">
                Tavsiya: Avval ushbu qurilmadagi ma'lumotlarni zaxira (JSON) fayli sifatida yuklab oling.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => exportAllDataAsJson()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Lokal zaxira nusxasini yuklab olish (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => resolveConflictWithCloud()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Bulutdagi versiyani qabul qilish (v{conflictData.currentRevision})</span>
              </button>

              <button
                type="button"
                onClick={() => resolveConflictWithLocal()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Ushbu qurilmadagi versiyani bulutga yuklash</span>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={closeConflictModal}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-1 px-2"
              >
                Keyinroq hal qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOCALSTORAGE TO CLOUD MIGRATION MODAL */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-100">Bulutli Xotiraga Ko‘chirish</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Bulutli PostgreSQL hisobingiz bo‘sh. Ushbu qurilmadagi mavjud vazifalar, odatlar va maqsadlaringizni
                  bulutli hisobingizga yuklashni xohlaysizmi?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div>
                Akkaunt: <b className="text-sky-400">@{user?.username || user?.firstName || user?.id}</b>
              </div>
              <p className="text-slate-400">
                Bulutga yuklangandan so‘ng, barcha qurilmalaringizda bir xil ma'lumotlar avtomatik yangilanadi.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => confirmMigrationToCloud()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Ha, bulutga yuklash (Migratsiya)</span>
              </button>

              <button
                type="button"
                onClick={() => exportAllDataAsJson()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Zaxira faylini yuklab olish (JSON)</span>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={closeMigrationModal}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-1 px-2"
              >
                Hozir emas, lokalda qolsin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACCOUNT SWITCH NOTICE MODAL */}
      {isAccountSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-100">Boshqa Akkaunt Aniqlandi</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ushbu qurilmadagi lokal ma'lumotlar avval boshqa Telegram akkauntiga ({switchedPreviousUser}) tegishli
                  bo‘lgan. Hozirgi akkaunt (@{user?.username || user?.firstName || user?.id}) ma'lumotlari bilan chalkashmaslik
                  uchun ular avtomatik yuklanmadi.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => exportAllDataAsJson()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Avvalgi ma'lumotlarni yuklab olish (JSON)</span>
              </button>

              <button
                type="button"
                onClick={dismissAccountSwitchNotice}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                <span>Tushunarli, yangi akkaunt bilan davom etish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
