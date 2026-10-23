import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory, Currency } from '../../types';
import { formatDateYMD, formatSom, formatMoney } from '../../utils/uzbekNlp';
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
} from 'lucide-react';

export const TabHarajatlar: React.FC<{
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}> = ({ isAddModalOpen, setIsAddModalOpen }) => {
  const { expenses, addExpense, deleteExpense, settings } = useApp();

  const todayStr = formatDateYMD(new Date());
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  const [selectedCategory, setSelectedCategory] = useState<string>('hammasi');

  // New Expense Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(35000);
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [category, setCategory] = useState<ExpenseCategory>('oziq_ovqat');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');

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
    if (!title.trim() || !amount) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    addExpense({
      title: title.trim(),
      amount: Number(amount),
      currency,
      category,
      date,
      time: timeStr,
      notes: notes.trim() || undefined,
      source: 'miniapp',
    });

    setTitle('');
    setAmount(currency === 'USD' ? 50 : 25000);
    setNotes('');
    setIsAddModalOpen(false);
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

                <div className="text-right shrink-0 flex items-center gap-3">
                  <span className={`font-bold text-sm sm:text-base ${expCurrency === 'USD' ? 'text-emerald-400' : 'text-white'}`}>
                    -{formatMoney(exp.amount, expCurrency)}
                  </span>
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                    title="O'chirish"
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100">Yangi Xarajat Kiritish</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nima uchun sarflandi? *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Xarajat nomi..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Summasi *
                  </label>
                  {/* Inline Currency Toggle (So'm UZS / Dollar $) without extra row */}
                  <div className="inline-flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency('UZS');
                        if (amount < 1000) setAmount(35000);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
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
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
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
                    type="number"
                    min="1"
                    step={currency === 'USD' ? '1' : '500'}
                    value={amount || ''}
                    onChange={e => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    required
                    placeholder="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3.5 pr-14 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold font-mono"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    {currency === 'USD' ? '$ USD' : "so'm"}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Kategoriya
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Sana</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Izoh (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Do'kon yoki tafsilot..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md active:scale-95"
                >
                  Saqlash
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
