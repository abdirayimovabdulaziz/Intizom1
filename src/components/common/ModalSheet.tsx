import React, { useEffect, useRef, useState, useId } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { registerModalBackButton } from '../../utils/telegram';

export interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isDirty?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  triggerElementRef?: React.RefObject<HTMLElement | null>;
}

// Global modal counter for body scroll locking
let openModalsCount = 0;
let originalBodyOverflow = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (openModalsCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openModalsCount++;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  openModalsCount = Math.max(0, openModalsCount - 1);
  if (openModalsCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}

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

  // Unsaved changes confirmation dialog state
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  // Attempt to close modal with dirty check
  const requestClose = () => {
    if (isDirty) {
      setShowDirtyConfirm(true);
    } else {
      onClose();
    }
  };

  const forceClose = () => {
    setShowDirtyConfirm(false);
    onClose();
  };

  // Manage open/close effects
  useEffect(() => {
    if (!isOpen) return;

    // Save current active element to restore focus on close
    previouslyFocusedElementRef.current = (triggerElementRef?.current || document.activeElement) as HTMLElement | null;

    lockBodyScroll();

    // Register with Telegram BackButton stack
    const unregisterBackButton = registerModalBackButton(modalId, () => {
      if (showDirtyConfirm) {
        setShowDirtyConfirm(false);
      } else {
        requestClose();
      }
    });

    // Auto focus first interactive element or modal container
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          // If first focusable is close button, try focusing first input if available
          const firstInput = modalRef.current.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea');
          if (firstInput) {
            firstInput.focus();
          } else {
            focusable[0].focus();
          }
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    // Escape key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showDirtyConfirm) {
          setShowDirtyConfirm(false);
        } else {
          requestClose();
        }
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null); // Visible elements only

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
      clearTimeout(timer);
      unregisterBackButton();
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown, true);

      // Return focus to previously focused element
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, isDirty, showDirtyConfirm, modalId]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) {
          requestClose();
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
        className={`bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl w-full ${maxWidthClasses} max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden focus:outline-none animate-in slide-in-from-bottom duration-200`}
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
          {children}
        </div>

        {/* Unsaved Changes Confirmation Overlay */}
        {showDirtyConfirm && (
          <div
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
  );
};
