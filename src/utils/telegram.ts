declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor?: string;
        backgroundColor?: string;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        initData?: string;
        platform?: string;
        version?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
      };
    };
  }
}

/**
 * Initializes Telegram WebApp SDK if running inside Telegram
 */
export const initTelegramWebApp = (): void => {
  if (typeof window === 'undefined') return;
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try {
      webApp.ready();
      webApp.expand();
      if (webApp.setHeaderColor) webApp.setHeaderColor('#0b1120');
      if (webApp.setBackgroundColor) webApp.setBackgroundColor('#0b1120');
    } catch (e) {
      console.warn('Telegram WebApp init notice:', e);
    }
  }
};

/**
 * Triggers Telegram Haptic Feedback with fallback to navigator.vibrate
 */
export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' = 'medium'
): void => {
  if (typeof window === 'undefined') return;

  const haptic = window.Telegram?.WebApp?.HapticFeedback;

  if (haptic) {
    try {
      if (type === 'selection') {
        haptic.selectionChanged();
        return;
      }
      if (type === 'success' || type === 'warning' || type === 'error') {
        haptic.notificationOccurred(type);
        return;
      }
      haptic.impactOccurred(type);
      return;
    } catch {
      // Fallback
    }
  }

  // Web vibration fallback for supported mobile browsers
  if ('vibrate' in navigator) {
    try {
      if (type === 'success') navigator.vibrate([20, 50, 30]);
      else if (type === 'error') navigator.vibrate([40, 40, 40]);
      else if (type === 'heavy') navigator.vibrate(35);
      else navigator.vibrate(15);
    } catch {
      // Ignore vibration error if not supported/permitted
    }
  }
};

/**
 * Returns user profile info if launched inside Telegram
 */
export const getTelegramUserData = () => {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
};
