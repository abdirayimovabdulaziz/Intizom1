import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCheck,
  Smartphone,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Zap,
} from 'lucide-react';

export const BotChatSimulator: React.FC = () => {
  const { messages, sendBotMessage, handleBotAction, isAiProcessing, setDisplayMode, setActiveTab } = useApp();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiProcessing) return;
    const textToSend = inputText;
    setInputText('');
    await sendBotMessage(textToSend);
  };

  const handleChipClick = async (chipText: string) => {
    if (isAiProcessing) return;
    await sendBotMessage(chipText);
  };

  const quickChips = [
    'harajat: 45000 tushlik',
    '5g kreatin',
    'l-arginin',
    'ertalab asalli suv',
    'sarf: 120000 taksi',
    'vazifa: ertaga soat 15:30 hisobot yuborish',
    'odat: har kuni 20 sahifa kitob',
    '/harajat',
    '/salomatlik',
    '/bugun',
  ];

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Telegram Header */}
      <div className="bg-[#1e293b] px-4 py-3 border-b border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#1e293b] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm text-white">Kunlik Yordamchi</h2>
              <span className="text-[10px] bg-sky-500/20 text-sky-400 font-medium px-1.5 py-0.5 rounded">bot</span>
            </div>
            <p className="text-xs text-sky-400">onlayn • @KunlikYordamchiBot</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDisplayMode('miniapp');
              setActiveTab('bosh_sahifa');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Telegram Mini App'ni ochish"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mini App</span>
          </button>
        </div>
      </div>

      {/* Telegram Chat Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#0b1329] via-[#0f172a] to-[#0b1329]">
        {/* Intro banner */}
        <div className="text-center my-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Telegram Bot & Mini App bitta bazada ishlaydi</span>
          </div>
        </div>

        {messages.map(msg => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`flex gap-2 max-w-[88%] sm:max-w-[80%] ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-3.5 text-sm shadow-md transition-all ${
                    isUser
                      ? 'bg-sky-700 text-white rounded-br-none border border-sky-600/50'
                      : msg.isReminder
                      ? 'bg-amber-950/80 border-2 border-amber-500/50 text-slate-100 rounded-bl-none shadow-amber-500/10'
                      : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60'
                  }`}
                >
                  {/* Message content */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-1">
                    {msg.text.split('\n').map((line, idx) => {
                      if (!line) return <div key={idx} className="h-1" />;

                      // Render bold and highlight tags
                      const formattedLine = line.replace(
                        /\*\*(.*?)\*\*/g,
                        '<strong>$1</strong>'
                      ).replace(
                        /`(.*?)`/g,
                        '<code class="px-1 py-0.5 rounded bg-black/30 font-mono text-xs text-sky-300">$1</code>'
                      );

                      return (
                        <p
                          key={idx}
                          dangerouslySetInnerHTML={{ __html: formattedLine }}
                        />
                      );
                    })}
                  </div>

                  {/* Inline keyboard actions (Telegram buttons) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                      {msg.actions.map(act => {
                        let btnStyle = 'bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border-sky-500/40';
                        if (act.variant === 'primary') {
                          btnStyle = 'bg-sky-600 hover:bg-sky-500 text-white border-transparent';
                        } else if (act.variant === 'danger') {
                          btnStyle = 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30';
                        } else if (act.variant === 'secondary') {
                          btnStyle = 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600';
                        }

                        return (
                          <button
                            key={act.id}
                            onClick={() => handleBotAction(msg.id, act)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 shadow-sm flex items-center gap-1.5 ${btnStyle}`}
                          >
                            <span>{act.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Message timestamp and read ticks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-sky-300" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Typing Indicator */}
        {isAiProcessing && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-1 px-3 bg-slate-800/50 rounded-full w-fit">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            <span>Kunlik Yordamchi tahlil qilmoqda...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="bg-[#1e293b]/80 border-t border-slate-800 px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          Tezkor:
        </span>
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleChipClick(chip)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap border border-slate-700 transition-all shrink-0 active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Telegram Message Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#1e293b] p-3 border-t border-slate-800 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Xabar yozing (masalan: harajat: 45000 tushlik, 5g kreatin, vazifa: ...)"
            className="w-full bg-[#0f172a] text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isAiProcessing}
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm ${
            inputText.trim() && !isAiProcessing
              ? 'bg-sky-600 hover:bg-sky-500 text-white active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title="Yuborish"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
