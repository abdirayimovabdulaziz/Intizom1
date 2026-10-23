/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderViewSwitcher } from './components/HeaderViewSwitcher';
import { NotificationBanner } from './components/NotificationBanner';
import { BotChatSimulator } from './components/BotChatSimulator';
import { MiniAppContainer } from './components/miniapp/MiniAppContainer';
import { initTelegramWebApp } from './utils/telegram';

function MainLayout() {
  const { displayMode, setDisplayMode } = useApp();

  useEffect(() => {
    initTelegramWebApp();
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      setDisplayMode('miniapp');
    }
  }, [setDisplayMode]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans antialiased">
      <HeaderViewSwitcher />
      <NotificationBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col">
        {displayMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[750px]">
            {/* Left Column: Telegram Bot Chat */}
            <div className="lg:col-span-5 h-[750px] lg:h-[calc(100vh-100px)] flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  Telegram Bot Interfeysi (@KunlikYordamchiBot)
                </span>
                <span className="text-[11px] text-slate-400">Tezkor kiritish va eslatmalar</span>
              </div>
              <div className="flex-1 min-h-0">
                <BotChatSimulator />
              </div>
            </div>

            {/* Right Column: Telegram Mini App */}
            <div className="lg:col-span-7 h-[750px] lg:h-[calc(100vh-100px)] flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Telegram Mini App Interfeysi
                </span>
                <span className="text-[11px] text-slate-400">Rejalarni ko'rish va boshqarish</span>
              </div>
              <div className="flex-1 min-h-0">
                <MiniAppContainer />
              </div>
            </div>
          </div>
        )}

        {displayMode === 'miniapp' && (
          <div className="max-w-md w-full mx-auto h-[820px] max-h-[calc(100vh-90px)] flex flex-col my-auto">
            <MiniAppContainer />
          </div>
        )}

        {displayMode === 'bot' && (
          <div className="max-w-md w-full mx-auto h-[820px] max-h-[calc(100vh-90px)] flex flex-col my-auto">
            <BotChatSimulator />
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
