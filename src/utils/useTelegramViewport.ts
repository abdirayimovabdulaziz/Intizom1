import { useState, useEffect } from 'react';
import { subscribeTelegramViewport, syncTelegramViewportAndSafeArea } from './telegram';

export interface TelegramViewportState {
  viewportHeight: number;
  safeBottom: number;
  isTelegram: boolean;
}

export const useTelegramViewport = (): TelegramViewportState => {
  const [state, setState] = useState<TelegramViewportState>(() => {
    const isTg = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
    const vpHeight = typeof window !== 'undefined'
      ? (window.Telegram?.WebApp?.viewportHeight || window.innerHeight)
      : 800;

    let safeB = 0;
    if (typeof window !== 'undefined') {
      const webApp = window.Telegram?.WebApp;
      if (webApp?.contentSafeAreaInset?.bottom) {
        safeB = Math.max(safeB, webApp.contentSafeAreaInset.bottom);
      }
      if (webApp?.safeAreaInset?.bottom) {
        safeB = Math.max(safeB, webApp.safeAreaInset.bottom);
      }
    }

    return {
      viewportHeight: vpHeight,
      safeBottom: safeB,
      isTelegram: isTg,
    };
  });

  useEffect(() => {
    // Initial sync
    syncTelegramViewportAndSafeArea();

    // Subscribe to Telegram and window events
    const unsubscribe = subscribeTelegramViewport(() => {
      const isTg = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
      const vpHeight = typeof window !== 'undefined'
        ? (window.Telegram?.WebApp?.viewportHeight || window.innerHeight)
        : 800;

      let safeB = 0;
      if (typeof window !== 'undefined') {
        const webApp = window.Telegram?.WebApp;
        if (webApp?.contentSafeAreaInset?.bottom) {
          safeB = Math.max(safeB, webApp.contentSafeAreaInset.bottom);
        }
        if (webApp?.safeAreaInset?.bottom) {
          safeB = Math.max(safeB, webApp.safeAreaInset.bottom);
        }
      }

      setState({
        viewportHeight: vpHeight,
        safeBottom: safeB,
        isTelegram: isTg,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
};
