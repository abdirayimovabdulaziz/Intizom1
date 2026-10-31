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
        BackButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        safeAreaInset?: {
          top: number;
          bottom: number;
          left: number;
          right: number;
        };
        contentSafeAreaInset?: {
          top: number;
          bottom: number;
          left: number;
          right: number;
        };
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme?: 'light' | 'dark';
        onEvent?: (eventType: string, eventHandler: () => void) => void;
        offEvent?: (eventType: string, eventHandler: () => void) => void;
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
      if (typeof webApp.ready === 'function') webApp.ready();
      if (typeof webApp.expand === 'function') webApp.expand();

      // Configure header and bg color matching clean dark theme (#090d16)
      if (typeof webApp.setHeaderColor === 'function') {
        webApp.setHeaderColor('#090d16');
      }
      if (typeof webApp.setBackgroundColor === 'function') {
        webApp.setBackgroundColor('#090d16');
      }

      // Synchronize CSS custom properties with Telegram viewport and safe-area insets
      syncTelegramViewportAndSafeArea();
    } catch (e) {
      console.warn('Telegram WebApp init notice:', e);
    }
  }
};

/**
 * Synchronizes Telegram viewport height and safe-area bottom inset to CSS variables.
 * Fallbacks safely to window.innerHeight and 0px if not running in Telegram.
 */
export const syncTelegramViewportAndSafeArea = (): void => {
  if (typeof window === 'undefined') return;
  const webApp = window.Telegram?.WebApp;
  const root = document.documentElement;

  // Viewport height
  const vpHeight = (webApp && typeof webApp.viewportHeight === 'number' && webApp.viewportHeight > 0)
    ? webApp.viewportHeight
    : window.innerHeight;

  root.style.setProperty('--app-viewport-height', `${vpHeight}px`);

  // Safe area bottom
  // Check both Telegram safeAreaInset and contentSafeAreaInset
  let safeBottom = 0;
  if (webApp?.contentSafeAreaInset?.bottom) {
    safeBottom = Math.max(safeBottom, webApp.contentSafeAreaInset.bottom);
  }
  if (webApp?.safeAreaInset?.bottom) {
    safeBottom = Math.max(safeBottom, webApp.safeAreaInset.bottom);
  }

  root.style.setProperty('--tg-safe-bottom', `${safeBottom}px`);
};

/**
 * Hook or helper to listen for Telegram viewport & safe-area changes with proper cleanup
 */
export const subscribeTelegramViewport = (onUpdate?: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const webApp = window.Telegram?.WebApp;
  const handler = () => {
    syncTelegramViewportAndSafeArea();
    if (onUpdate) onUpdate();
  };

  // Initial sync
  handler();

  // Telegram event handlers
  if (webApp?.onEvent) {
    try {
      webApp.onEvent('viewportChanged', handler);
      webApp.onEvent('safeAreaChanged', handler);
      webApp.onEvent('contentSafeAreaChanged', handler);
      webApp.onEvent('themeChanged', handler);
    } catch (e) {
      console.warn('Telegram onEvent warning:', e);
    }
  }

  // Window resize fallback
  window.addEventListener('resize', handler);

  // Return cleanup function
  return () => {
    if (webApp?.offEvent) {
      try {
        webApp.offEvent('viewportChanged', handler);
        webApp.offEvent('safeAreaChanged', handler);
        webApp.offEvent('contentSafeAreaChanged', handler);
        webApp.offEvent('themeChanged', handler);
      } catch {
        // Ignore
      }
    }
    window.removeEventListener('resize', handler);
  };
};

// ============================================================================
// Modal BackButton Stack Manager
// Supports nested modals and closes the topmost modal on Telegram BackButton
// ============================================================================
type ModalCloseHandler = () => void;
const modalStack: { id: string; onClose: ModalCloseHandler }[] = [];

let backButtonInitialized = false;

function handleTelegramBackClick(): void {
  if (modalStack.length > 0) {
    const topModal = modalStack[modalStack.length - 1];
    topModal.onClose();
  }
}

function updateTelegramBackButtonVisibility(): void {
  if (typeof window === 'undefined') return;
  const backButton = window.Telegram?.WebApp?.BackButton;
  if (!backButton) return;

  try {
    if (!backButtonInitialized && typeof backButton.onClick === 'function') {
      backButton.onClick(handleTelegramBackClick);
      backButtonInitialized = true;
    }

    if (modalStack.length > 0) {
      if (typeof backButton.show === 'function') backButton.show();
    } else {
      if (typeof backButton.hide === 'function') backButton.hide();
    }
  } catch (e) {
    console.warn('Telegram BackButton warning:', e);
  }
}

/**
 * Registers a modal or sheet with the Telegram BackButton stack.
 * Returns an unregister function to be called on modal close or unmount.
 */
export const registerModalBackButton = (id: string, onClose: ModalCloseHandler): (() => void) => {
  // Remove any previous entry with this ID
  const existingIdx = modalStack.findIndex(m => m.id === id);
  if (existingIdx !== -1) {
    modalStack.splice(existingIdx, 1);
  }

  modalStack.push({ id, onClose });
  updateTelegramBackButtonVisibility();

  return () => {
    const idx = modalStack.findIndex(m => m.id === id);
    if (idx !== -1) {
      modalStack.splice(idx, 1);
    }
    updateTelegramBackButtonVisibility();
  };
};

/**
 * Triggers Telegram Haptic Feedback with fallback to navigator.vibrate.
 * Safe to call; only runs when enabled.
 */
export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' = 'medium',
  enabled: boolean = true
): void => {
  if (!enabled || typeof window === 'undefined') return;

  const haptic = window.Telegram?.WebApp?.HapticFeedback;

  if (haptic) {
    try {
      if (type === 'selection' && typeof haptic.selectionChanged === 'function') {
        haptic.selectionChanged();
        return;
      }
      if ((type === 'success' || type === 'warning' || type === 'error') && typeof haptic.notificationOccurred === 'function') {
        haptic.notificationOccurred(type);
        return;
      }
      if (typeof haptic.impactOccurred === 'function') {
        const impactStyle: 'light' | 'medium' | 'heavy' =
          type === 'light' || type === 'heavy' ? type : 'medium';
        haptic.impactOccurred(impactStyle);
        return;
      }
    } catch {
      // Fallback below
    }
  }

  // Web vibration fallback for supported mobile browsers
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') navigator.vibrate([20, 50, 30]);
      else if (type === 'error') navigator.vibrate([40, 40, 40]);
      else if (type === 'heavy') navigator.vibrate(35);
      else navigator.vibrate(15);
    } catch {
      // Ignore vibration error if not permitted
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
