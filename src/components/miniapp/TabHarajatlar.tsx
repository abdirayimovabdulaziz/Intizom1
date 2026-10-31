import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory, Currency } from '../../types';
import { formatDateYMD, formatSom, formatMoney } from '../../utils/uzbekNlp';
import { getTimeStringInTimezone } from '../../utils/domainCalculations';
import { ModalSheet } from '../common/ModalSheet';
import { triggerHaptic } from '../../utils/telegram';
import {
  Wallet,
  Plus,
  Trash2,
  TrendingDown,
  PieChart,
  Calendar,
  X,
  Tag,
  ArrowUpRight,
  Pencil,
  AlertCircle,
} from 'lucide-react';

export const TabHarajatlar: React.FC<{
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}> = ({ isAddModalOpen, setIsAddModalOpen }) => {
  const { todayStr, timezone, expenses, addExpense, updateExpense, deleteExpense, settings } = useApp();

  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const [selectedCategory, setSelectedCategory] = useState<string>('hammasi');

  // New Expense Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(35000);
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [category, setCategory] = useState<ExpenseCategory>('oziq_ovqat');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Expense Form State
  const [editingExpense, setEditingExpense] = useState<(typeof expenses)[0] | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState<number>(35000);
  const [editCurrency, setEditCurrency] = useState<Currency>('UZS');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('oziq_ovqat');
  const [editDate, setEditDate] = useState(todayStr);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const openEditModal = (exp: (typeof expenses)[0]) => {
    setEditingExpense(exp);
    setEditTitle(exp.title);
    setEditAmount(exp.amount);
    setEditCurrency(exp.currency || 'UZS');
    setEditCategory(exp.category || 'oziq_ovqat');
    setEditDate(exp.date);
    setEditNotes(exp.notes || '');
    setEditError('');
    setIsSubmittingEdit(false);
  };

  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEdit || !editingExpense) return;

    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditError("Xarajat nomi yoki izohi kiritilishi shart.");
      return;
    }

    const numAmount = Number(editAmount);
    if (!numAmount || isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      setEditError("Summa musbat chekli son bo'lishi shart.");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      updateExpense(editingExpense.id, {
        title: trimmed,
        amount: numAmount,
        currency: editCurrency,
        category: editCategory,
        date: editDate,
        notes: editNotes.trim() || undefined,
      });

      triggerHaptic('success', settings.reminderSound);
      setEditingExpense(null);
    } catch (err: any) {
      setEditError(err?.message || "Xarajatni yangilashda xatolik yuz berdi.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Calculations (UZS and USD)
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const todayTotalSom = todayExpenses.filter(e => e.currency !== 'USD').reduce((sum, e) => sum + e.amount, 0);
  const todayTotalUsd = todayExpenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + e.amount, 0);

  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
  const monthTotalSom = monthExpenses.filter(e => e.currency !== 'USD').reduce((sum, e) => sum + e.amount, 0);
  const monthTotalUsd = monthExpenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + e.amount, 0);

  const monthlyBudget = settings.monthlyExpenseBudget || 3500000;
  const budgetUsagePercent = Math.min(100, Math.round((monthTotalSom / monthlyBudget) * 100));

  // Category labels and icons
  const categoryMeta: Record<ExpenseCategory, { label: string; color: string }> = {
    oziq_ovqat: { label: 'Oziq-ovqat', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    transport: { label: 'Transport / Taksi', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    sport: { label: 'Sport', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    salomatlik: { label: 'Salomatlik', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    talim: { label: 'Ta\'lim / Kitob', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    shaxsiy: { label: 'Shaxsiy xaridlar', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    boshqa: { label: 'Boshqa', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  };

  const filteredExpenses = expenses.filter(e => {
    if (selectedCategory === 'hammasi') return true;
    return e.category === selectedCategory;
  });

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCreate) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Nima uchun sarflangani (xarajat nomi) kiritilishi shart.");
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      setCreateError("Summa musbat chekli son bo'lishi shart.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const timeStr = getTimeStringInTimezone(new Date(), timezone);

      addExpense({
        title: trimmed,
        amount: numAmount,
        currency,
        category,
        date,
        time: timeStr,
        notes: notes.trim() || undefined,
        source: 'miniapp',
      });

      triggerHaptic('success', settings.reminderSound);
      setTitle('');
      setAmount(currency === 'USD' ? 50 : 25000);
      setNotes('');
      setCreateError('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      setCreateError(err?.message || "Xarajatni saqlashda xatolik yuz berdi.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const renderTotalLabel = (som: number, usd: number) => {
    if (usd > 0 && som > 0) {
      return `${formatSom(som)} + ${usd} $`;
    }
    if (usd > 0) {
      return `${usd} $`;
    }
    return formatSom(som);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Xarajatlar & Moliya</h2>
          <p className="text-xs text-slate-400">Kunlik xarajatlar (So'm va Dollar) hisobi</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Xarajat</span>
        </button>
      </div>

      {/* Summary Cards: Today & Month */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today's Expense Card */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Bugungi sarf</span>
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
            {renderTotalLabel(todayTotalSom, todayTotalUsd)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {todayExpenses.length} ta xarajat qayd etildi
          </p>
        </div>

        {/* Monthly Expense Card */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Oylik umumiy</span>
            <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <PieChart className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-sky-400 tracking-tight truncate">
            {renderTotalLabel(monthTotalSom, monthTotalUsd)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Reja: {formatSom(monthlyBudget)}
          </p>
        </div>
      </div>

      {/* Budget Progress Indicator */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-3.5">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-300">Oylik so'm byudjeti sarflanishi</span>
          <span className="text-emerald-400 font-mono font-bold">{budgetUsagePercent}%</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetUsagePercent > 90
                ? 'bg-rose-500'
                : budgetUsagePercent > 70
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${budgetUsagePercent}%` }}
          />
        </div>
      </div>

      {/* Categories Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => setSelectedCategory('hammasi')}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
            selectedCategory === 'hammasi'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
          }`}
        >
          Hammasi ({expenses.length})
        </button>

        {Object.entries(categoryMeta).map(([catKey, meta]) => (
          <button
            key={catKey}
            onClick={() => setSelectedCategory(catKey)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all ${
              selectedCategory === catKey
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* Expenses History List */}
      <div className="space-y-2.5">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="text-slate-300 font-semibold">Hozircha xarajatlar qayd etilmagan</p>
            <p className="text-slate-400 text-[11px]">
              Xarajatlarni so'mda yoki dollarda (masalan: 1400$ iPhone) kiritishingiz mumkin!
            </p>
            <div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Birinchi xarajatni kiritish</span>
              </button>
            </div>
          </div>
        ) : (
          filteredExpenses.map(exp => {
            const meta = categoryMeta[exp.category] || categoryMeta.boshqa;
            const expCurrency = exp.currency || 'UZS';

            return (
              <div
                key={exp.id}
                className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-100 truncate">
                      {exp.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {exp.date} {exp.time ? `• ${exp.time}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <span className={`font-bold text-sm sm:text-base mr-1 ${expCurrency === 'USD' ? 'text-emerald-400' : 'text-white'}`}>
                    -{formatMoney(exp.amount, expCurrency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(exp)}
                    aria-label={`Xarajatni tahrirlash: ${exp.title}`}
                    className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-sky-400 rounded-xl hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Ushbu xarajatni o'chirmoqchimisiz?")) {
                        deleteExpense(exp.id);
                        triggerHaptic('warning', settings.reminderSound);
                      }
                    }}
                    aria-label={`Xarajatni o'chirish: ${exp.title}`}
                    className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Expense Modal */}
      <ModalSheet
        isOpen={isAddModalOpen}
        onClose={() => {
          setCreateError('');
          setIsAddModalOpen(false);
        }}
        title="Yangi Xarajat Kiritish"
        subtitle="Kunlik xarajat yoki xaridni belgilang"
        isDirty={!!title.trim()}
      >
        <div className="space-y-4 py-1">
          {createError && (
            <div
              role="alert"
              className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateExpense} className="space-y-3.5">
            <div>
              <label htmlFor="exp-create-title" className="block text-xs font-semibold text-slate-300 mb-1">
                Nima uchun sarflandi? *
              </label>
              <input
                id="exp-create-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Xarajat nomi..."
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="exp-create-amount" className="block text-xs font-semibold text-slate-300">
                  Summasi *
                </label>
                {/* Inline Currency Toggle (So'm UZS / Dollar $) */}
                <div className="inline-flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('UZS');
                      if (amount < 1000) setAmount(35000);
                    }}
                    className={`px-3 py-1 min-h-[36px] rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none ${
                      currency === 'UZS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    So'm (UZS)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('USD');
                      if (amount > 10000) setAmount(100);
                    }}
                    className={`px-3 py-1 min-h-[36px] rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none ${
                      currency === 'USD'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dollar ($)
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id="exp-create-amount"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step={currency === 'USD' ? '1' : '500'}
                  value={amount || ''}
                  onChange={e => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  required
                  placeholder="0"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3.5 pr-16 py-2.5 text-base sm:text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none font-semibold font-mono"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  {currency === 'USD' ? '$ USD' : "so'm"}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="exp-create-category" className="block text-xs font-semibold text-slate-300 mb-1">
                Kategoriya
              </label>
              <select
                id="exp-create-category"
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                <option value="oziq_ovqat">Oziq-ovqat</option>
                <option value="transport">Transport / Taksi</option>
                <option value="sport">Sport</option>
                <option value="salomatlik">Salomatlik</option>
                <option value="talim">Ta'lim / Kitoblar</option>
                <option value="shaxsiy">Shaxsiy xaridlar</option>
                <option value="boshqa">Boshqa</option>
              </select>
            </div>

            <div>
              <label htmlFor="exp-create-date" className="block text-xs font-semibold text-slate-300 mb-1">Sana</label>
              <input
                id="exp-create-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="exp-create-notes" className="block text-xs font-semibold text-slate-300 mb-1">
                Izoh (Ixtiyoriy)
              </label>
              <input
                id="exp-create-notes"
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Do'kon yoki tafsilot..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 min-h-[44px] rounded-xl border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 min-h-[44px] rounded-xl shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                {isSubmittingCreate ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </form>
        </div>
      </ModalSheet>

      {/* Edit Expense Modal */}
      <ModalSheet
        isOpen={!!editingExpense}
        onClose={() => {
          setEditError('');
          setEditingExpense(null);
        }}
        title="Xarajatni Tahrirlash"
        subtitle="Summa, valyuta yoki toifani to'g'irlash"
        isDirty={!!(editingExpense && (editTitle !== editingExpense.title || editAmount !== editingExpense.amount))}
      >
        <div className="space-y-4 py-1">
          {editError && (
            <div
              role="alert"
              className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateExpense} className="space-y-3.5">
            {/* Title */}
            <div>
              <label htmlFor="exp-edit-title" className="block text-xs font-semibold text-slate-300 mb-1">
                Xarajat nomi / Izoh *
              </label>
              <input
                id="exp-edit-title"
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Masalan: Tushlik, Benzin, Kitob xaridi"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Amount & Currency Inline */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="exp-edit-amount" className="text-xs font-semibold text-slate-300">
                  Summasi *
                </label>
                {/* Inline Currency Toggle */}
                <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setEditCurrency('UZS')}
                    className={`px-3 py-1 min-h-[36px] text-xs font-semibold rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none ${
                      editCurrency === 'UZS'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    So'm (UZS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCurrency('USD')}
                    className={`px-3 py-1 min-h-[36px] text-xs font-semibold rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none ${
                      editCurrency === 'USD'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dollar ($)
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id="exp-edit-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={editAmount || ''}
                  onChange={e => setEditAmount(Number(e.target.value))}
                  placeholder="0"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3.5 pr-16 py-2.5 text-base sm:text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {editCurrency === 'USD' ? 'USD ($)' : "so'm"}
                </span>
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="exp-edit-category" className="block text-xs font-semibold text-slate-300 mb-1">Toifa</label>
              <select
                id="exp-edit-category"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                <option value="oziq_ovqat">Oziq-ovqat & Taom</option>
                <option value="transport">Transport & Benzin / Taksi</option>
                <option value="salomatlik">Salomatlik & Dori / Sport</option>
                <option value="talim">Ta'lim & Kitoblar</option>
                <option value="shaxsiy">Shaxsiy & Xaridlar</option>
                <option value="boshqa">Boshqa xarajatlar</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="exp-edit-date" className="block text-xs font-semibold text-slate-300 mb-1">Sana</label>
              <input
                id="exp-edit-date"
                type="date"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="exp-edit-notes" className="block text-xs font-semibold text-slate-300 mb-1">
                Izoh (Ixtiyoriy)
              </label>
              <input
                id="exp-edit-notes"
                type="text"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Do'kon yoki tafsilot..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-base sm:text-sm text-slate-100 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 min-h-[44px] rounded-xl border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 min-h-[44px] rounded-xl shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
              >
                {isSubmittingEdit ? "Saqlanmoqda..." : "O'zgarishlarni Saqlash"}
              </button>
            </div>
          </form>
        </div>
      </ModalSheet>

      {/* Safe bottom spacer */}
      <div className="h-6 shrink-0" aria-hidden="true" />
    </div>
  );
};
