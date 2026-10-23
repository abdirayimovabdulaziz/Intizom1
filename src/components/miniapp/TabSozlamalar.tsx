import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  Bell,
  Trash2,
  Check,
  Download,
  Upload,
  Copy,
  ExternalLink,
  Bot,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/telegram';

export const TabSozlamalar: React.FC = () => {
  const {
    settings,
    updateSettings,
    clearAllData,
    triggerSimulatedReminder,
    exportAllDataAsJson,
    importDataFromJson,
    setActiveTab,
  } = useApp();

  const [name, setName] = useState(settings.name);
  const [username, setUsername] = useState(settings.username);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [morningTime, setMorningTime] = useState(settings.morningTime);
  const [eveningTime, setEveningTime] = useState(settings.eveningTime);
  const [monthlyExpenseBudget, setMonthlyExpenseBudget] = useState(settings.monthlyExpenseBudget || 3500000);
  const [reminderSound, setReminderSound] = useState(settings.reminderSound);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      name,
      username,
      timezone,
      morningTime,
      eveningTime,
      monthlyExpenseBudget: Number(monthlyExpenseBudget),
      reminderSound,
    });
    triggerHaptic('success');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const getAppUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://ais-dev-yjbl2hbg4eobrzrmuvgcnh-543072210204.asia-southeast1.run.app';
  };

  const handleCopyUrl = () => {
    const url = getAppUrl();
    navigator.clipboard.writeText(url);
    triggerHaptic('success');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importDataFromJson(content);
        setImportStatus(result.message);
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header with Back Button */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('bosh_sahifa');
          }}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center shadow-sm"
          title="Bosh sahifaga qaytish"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Sozlamalar & Botga Ulash</h2>
          <p className="text-xs text-slate-400">Telegram Bot, ma'lumotlar zaxirasi va parametrlar</p>
        </div>
      </div>

      {/* 1. REAL TELEGRAM BOTGA ULASH KARTASI */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 border border-sky-500/30 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-100">Telegram Botga Ulash (BotFather)</h4>
            <p className="text-[11px] text-slate-400">Ushbu Mini App'ni o'zingizning haqiqiy Telegram botingizga ulash</p>
          </div>
        </div>

        {/* WebApp URL Copy Box */}
        <div>
          <label className="block text-[11px] font-medium text-slate-300 mb-1">
            Mini App WebApp Havolasi (BotFather uchun):
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-300 font-mono truncate select-all">
              {getAppUrl()}
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className={`px-3 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm min-h-[38px] ${
                copiedUrl
                  ? 'bg-emerald-600 text-white border border-emerald-500'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/40'
              }`}
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Nusxalandi</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nusxa olish</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Step Instruction */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <p className="text-slate-300 leading-relaxed">
              Telegram'da <span className="font-semibold text-sky-300">@BotFather</span> ga kiring va{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-200">/newbot</code> buyrug'i orqali yangi bot yarating.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <p className="text-slate-300 leading-relaxed">
              Bot nomini yozib HTTP API tokenni oling (e.g. <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-400">123456:ABC...</code>).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <p className="text-slate-300 leading-relaxed">
              <span className="font-semibold text-sky-300">@BotFather</span> da{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-200">/newapp</code> buyrug'ini bering, botingizni tanlang va yuqoridagi nusxalangan havolani kiriting!
            </p>
          </div>
        </div>
      </div>

      {/* 2. MA'LUMOTLAR ZAXIRASI VA TIKLASH (EXPORT / IMPORT) */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
          <Download className="w-4 h-4 text-emerald-400" />
          <h4 className="font-semibold text-sm text-slate-100">Zaxira Nusxa & Tiklash (Backup / Restore)</h4>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Kiritilgan barcha vazifalar, odatlar va xarajatlarni JSON fayl qilib yuklab olish yoki avvalgi nusxadan tiklash.
        </p>

        {importStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              exportAllDataAsJson();
            }}
            className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Yuklab olish (.JSON)</span>
          </button>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                fileInputRef.current?.click();
              }}
              className="w-full bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Fayldan tiklash</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. PROFILE & PREFERENCES FORM */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Profile Card */}
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-md">
              {name.charAt(0) || 'U'}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{name || 'Foydalanuvchi'}</h4>
              <p className="text-xs text-sky-400">@{username || 'user'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ismingiz</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Telegram username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Timezone & Notification Timings */}
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Clock className="w-4 h-4 text-sky-400" />
            <h4 className="font-semibold text-sm text-slate-100">Vaqt, Eslatmalar & Byudjet</h4>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Vaqt zonasi (Timezone)</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="Asia/Tashkent (UTC+5)">Asia/Tashkent (UTC+5, O'zbekiston)</option>
              <option value="Asia/Samarkand (UTC+5)">Asia/Samarkand (UTC+5)</option>
              <option value="Europe/Istanbul (UTC+3)">Europe/Istanbul (UTC+3)</option>
              <option value="Europe/London (UTC+1)">Europe/London (UTC+1)</option>
              <option value="America/New_York (UTC-4)">America/New_York (UTC-4)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ertalabki reja vaqti</label>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Kechki sarhisob vaqti</label>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Oylik xarajatlar byudjeti (so'm)
            </label>
            <input
              type="number"
              step="100000"
              value={monthlyExpenseBudget}
              onChange={(e) => setMonthlyExpenseBudget(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-xs font-medium text-slate-200 block">Eslatma signali & Haptic</span>
              <span className="text-[11px] text-slate-400">Telegram tebranishi va bildirishnoma</span>
            </div>
            <input
              type="checkbox"
              checked={reminderSound}
              onChange={(e) => setReminderSound(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                triggerSimulatedReminder();
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              Eslatmani sinab ko'rish (Test Reminder)
            </button>
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5"
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Sozlamalar saqlandi!</span>
            </>
          ) : (
            <span>Sozlamalarni saqlash</span>
          )}
        </button>
      </form>

      {/* 4. BOSH QILISH VA TOZALASH (CLEAN RESET) */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Boshqaruv & Tozalash
        </h4>

        <div className="bg-slate-900/60 border border-rose-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-semibold text-rose-300">Barcha ma'lumotlarni tozalash</h5>
            <p className="text-[11px] text-slate-400">Hozirgi barcha vazifalar, odatlar va xarajatlarni o'chirib, toza holatga keltiradi</p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('warning');
              if (window.confirm("Barcha vazifalar, odatlar va xarajatlarni to'liq tozalashni tasdiqlaysizmi?")) {
                clearAllData();
              }
            }}
            className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors shrink-0 flex items-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tozalash</span>
          </button>
        </div>
      </div>
    </div>
  );
};
