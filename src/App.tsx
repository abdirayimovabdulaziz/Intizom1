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
import { useTelegramViewport } from './utils/useTelegramViewport';

function MainLayout() {
  const { displayMode } = useApp();
  useTelegramViewport();

  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <div
      style={{
        height: 'var(--app-viewport-height, 100dvh)',
        maxHeight: 'var(--app-viewport-height, 100dvh)',
      }}
      className="w-full bg-[#090d16] text-slate-100 flex flex-col font-sans antialiased overflow-hidden select-none"
    >
      <NotificationBanner />

      <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {displayMode === 'bot' ? (
          <div className="max-w-xl w-full mx-auto flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
            <BotChatSimulator />
          </div>
        ) : (
          <div className="w-full max-w-xl mx-auto flex-1 min-h-0 flex flex-col overflow-hidden">
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
