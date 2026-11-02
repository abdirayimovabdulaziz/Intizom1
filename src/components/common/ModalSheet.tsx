import React, { useEffect, useRef, useState, useId, useCallback, createContext, useContext } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  registerModalBackButton,
  unregisterModalBackButton,
  isTopModal,
  lockBodyScroll,
  unlockBodyScroll,
} from '../../utils/telegram';

export interface ModalSheetContextValue {
  requestClose: () => void;
  forceClose: () => void;
  isDirty: boolean;
}

export const ModalSheetContext = createContext<ModalSheetContextValue>({
  requestClose: () => {},
  forceClose: () => {},
  isDirty: false,
});

export const useModalSheet = () => useContext(ModalSheetContext);

export interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode | ((helpers: { requestClose: () => void; forceClose: () => void }) => React.ReactNode);
  isDirty?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  triggerElementRef?: React.RefObject<HTMLElement | null>;
}

export const ModalCancelButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  onClick,
  children = 'Bekor qilish',
  className,
  ...props
}) => {
  const { requestClose } = useModalSheet();
  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) onClick(e);
        requestClose();
      }}
      className={
        className ||
        'flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-3 rounded-xl border border-slate-700 min-h-[44px] transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none'
      }
      {...props}
    >
      {children}
    </button>
  );
};

export const ModalSheet: React.FC<ModalSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  icon,
  children,
  isDirty = false,
  maxWidth = 'md',
  triggerElementRef,
}) => {
  const descText = subtitle || description;
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const descId = `${modalId}-desc`;

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const lastFormFocusedElementRef = useRef<HTMLElement | null>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);

  // Unsaved changes confirmation dialog state
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  // Mutable refs for stable event handlers & lifecycle separation
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const showDirtyConfirmRef = useRef(showDirtyConfirm);
  showDirtyConfirmRef.current = showDirtyConfirm;

  // Unified close request: checks dirty state, opens confirm if dirty
  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      lastFormFocusedElementRef.current = (document.activeElement as HTMLElement) || null;
      setShowDirtyConfirm(true);
    } else {
      onCloseRef.current();
    }
  }, []);

  // Force close without dirty check (used on confirm or after successful save)
  const forceClose = useCallback(() => {
    setShowDirtyConfirm(false);
    onCloseRef.current();
  }, []);

  // 1. LIFECYCLE EFFECT: strictly separated from isDirty and showDirtyConfirm
  // Autofocus, scroll lock, and return of focus run ONLY on true open/close
  useEffect(() => {
    if (!isOpen) {
      setShowDirtyConfirm(false);
      return;
    }

    // Save current active element (or triggerElementRef) to restore focus on close
    previouslyFocusedElementRef.current =
      triggerElementRef?.current || ((document.activeElement as HTMLElement) ?? null);

    // Lock body scroll using Set-based tracker (immune to Strict Mode re-mounts)
    lockBodyScroll(modalId);

    // Initial autofocus timer: fires ONLY once upon modal opening
    const focusTimer = setTimeout(() => {
      if (!modalRef.current) return;
      const firstInput = modalRef.current.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (firstInput) {
        firstInput.focus();
      } else {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 30);

    return () => {
      clearTimeout(focusTimer);
      unlockBodyScroll(modalId);

      // Return focus to previously focused trigger element
      const prevEl = previouslyFocusedElementRef.current;
      if (prevEl && typeof prevEl.focus === 'function') {
        try {
          prevEl.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, modalId]); // Notice: NO isDirty or showDirtyConfirm dependency!

  // 2. Telegram BackButton stack registration (updates in place without changing stack position)
  useEffect(() => {
    if (!isOpen) return;

    const unregister = registerModalBackButton(modalId, () => {
      if (showDirtyConfirmRef.current) {
        setShowDirtyConfirm(false);
      } else {
        requestClose();
      }
    });

    return () => {
      unregister();
    };
  }, [isOpen, modalId, requestClose]);

  // 3. Dirty Confirmation Dialog Focus Management
  useEffect(() => {
    if (!isOpen) return;

    if (showDirtyConfirm) {
      // Dialog opened: focus "Davom etish" button
      const timer = setTimeout(() => {
        resumeBtnRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else {
      // Dialog closed ("Davom etish"): return focus to form element
      const formEl = lastFormFocusedElementRef.current;
      if (formEl && typeof formEl.focus === 'function') {
        try {
          formEl.focus();
        } catch {
          // ignore
        }
        lastFormFocusedElementRef.current = null;
      }
    }
  }, [showDirtyConfirm, isOpen]);

  // 4. Keyboard handling: Escape and Tab trap ONLY for the topmost modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the topmost modal handles keyboard events
      if (!isTopModal(modalId)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showDirtyConfirmRef.current) {
          setShowDirtyConfirm(false);
        } else {
          requestClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        const container = modalRef.current;
        if (!container) return;

        // If dirty confirm is showing, trap focus inside alertdialog controls
        const scope = showDirtyConfirmRef.current
          ? (confirmDialogRef.current || container)
          : container;

        const focusables = Array.from(
          scope.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null || el.getClientRects().length > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, modalId, requestClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <ModalSheetContext.Provider value={{ requestClose, forceClose, isDirty }}>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={e => {
          if (e.target === e.currentTarget) {
            if (!isTopModal(modalId)) return;
            if (showDirtyConfirm) {
              setShowDirtyConfirm(false);
            } else {
              requestClose();
            }
          }
        }}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descText ? descId : undefined}
          tabIndex={-1}
          className={`bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl w-full ${maxWidthClasses} max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden focus:outline-none animate-in slide-in-from-bottom duration-200 relative`}
        >
          {/* Mobile drag handle bar indicator */}
          <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" aria-hidden="true" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2.5 pr-2 min-w-0">
              {icon && <div className="shrink-0">{icon}</div>}
              <div className="min-w-0">
                <h2 id={titleId} className="font-bold text-base sm:text-lg text-slate-100 truncate">
                  {title}
                </h2>
                {descText && (
                  <p id={descId} className="text-xs text-slate-400 truncate mt-0.5">
                    {descText}
                  </p>
                )}
              </div>
            </div>

            {/* Close button with >= 44x44px touch area */}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Yopish"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-6 overscroll-contain">
            {typeof children === 'function' ? children({ requestClose, forceClose }) : children}
          </div>

          {/* Unsaved Changes Confirmation Overlay */}
          {showDirtyConfirm && (
            <div
              ref={confirmDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-label="Saqlanmagan ma'lumotlar"
              className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-sm p-5 flex flex-col justify-center items-center text-center animate-in fade-in duration-150"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">Saqlanmagan ma'lumotlar bor</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs">
                Kiritilgan ma'lumotlar saqlanmadi. Haqiqatan ham bekor qilib chiqmoqchimisiz?
              </p>
              <div className="flex items-center gap-2.5 mt-5 w-full max-w-xs">
                <button
                  ref={resumeBtnRef}
                  type="button"
                  onClick={() => setShowDirtyConfirm(false)}
                  className="flex-1 py-2.5 px-3 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
                >
                  Davom etish
                </button>
                <button
                  type="button"
                  onClick={forceClose}
                  className="flex-1 py-2.5 px-3 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                >
                  Ha, bekor qilish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalSheetContext.Provider>
  );
};
