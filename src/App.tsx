/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NotificationBanner } from './components/NotificationBanner';
import { BotChatSimulator } from './components/BotChatSimulator';
import { MiniAppContainer } from './components/miniapp/MiniAppContainer';
import { initTelegramWebApp } from './utils/telegram';

function MainLayout() {
  const { displayMode } = useApp();

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#090d16] text-slate-100 flex flex-col font-sans antialiased">
      <NotificationBanner />

      <main className="flex-1 w-full flex flex-col">
        {displayMode === 'bot' ? (
          <div className="max-w-xl w-full mx-auto flex-1 flex flex-col p-3">
            <BotChatSimulator />
          </div>
        ) : (
          <div className="w-full max-w-xl mx-auto flex-1 flex flex-col">
            <MiniAppContainer />
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
