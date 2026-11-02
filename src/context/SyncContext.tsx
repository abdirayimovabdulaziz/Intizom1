import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  SyncStatus,
  ConflictData,
  STORAGE_KEY_ACCOUNT_ID,
  STORAGE_KEY_CLOUD_REVISION,
  apiAuthenticateTelegram,
  apiAuthenticateDemo,
  apiFetchCurrentUser,
  apiFetchCloudState,
  apiSaveCloudSnapshot,
} from '../services/syncService';
import { TelegramUser, UserSnapshot } from '../../server/types';
import { useApp } from './AppContext';

interface SyncContextType {
  syncStatus: SyncStatus;
  cloudRevision: number | null;
  user: TelegramUser | null;
  isLiveDatabase: boolean;
  conflictData: ConflictData | null;
  isMigrationModalOpen: boolean;
  isConflictModalOpen: boolean;
  isAccountSwitchModalOpen: boolean;
  switchedPreviousUser: string | null;
  triggerSyncNow: () => Promise<void>;
  resolveConflictWithCloud: () => Promise<void>;
  resolveConflictWithLocal: () => Promise<void>;
  confirmMigrationToCloud: () => Promise<void>;
  closeConflictModal: () => void;
  closeMigrationModal: () => void;
  dismissAccountSwitchNotice: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    tasks,
    habits,
    goals,
    expenses,
    activities,
    settings,
    importDataFromJson,
    exportAllDataAsJson,
  } = useApp();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('auth_required');
  const [cloudRevision, setCloudRevision] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLOUD_REVISION);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLiveDatabase, setIsLiveDatabase] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isAccountSwitchModalOpen, setIsAccountSwitchModalOpen] = useState(false);
  const [switchedPreviousUser, setSwitchedPreviousUser] = useState<string | null>(null);

  // References to keep latest state in async queues without stale closures
  const stateRef = useRef({
    tasks,
    habits,
    goals,
    expenses,
    activities,
    settings,
    cloudRevision,
    user,
    syncStatus,
  });

  stateRef.current = {
    tasks,
    habits,
    goals,
    expenses,
    activities,
    settings,
    cloudRevision,
    user,
    syncStatus,
  };

  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const retryCountRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadDoneRef = useRef(false);

  // Build current snapshot from context
  const getCurrentSnapshot = useCallback((): UserSnapshot => {
    return {
      tasks: stateRef.current.tasks,
      habits: stateRef.current.habits,
      goals: stateRef.current.goals,
      expenses: stateRef.current.expenses,
      activities: stateRef.current.activities,
      settings: stateRef.current.settings,
    };
  }, []);

  // Total local items count
  const getLocalItemsCount = useCallback((): number => {
    const s = stateRef.current;
    return s.tasks.length + s.habits.length + s.goals.length + s.expenses.length + s.activities.length;
  }, []);

  // Atomic Sequential Save Execution
  const executeSave = useCallback(async () => {
    const { user: currentUser, cloudRevision: currentRev, syncStatus: currentStatus } = stateRef.current;

    if (!currentUser) return;
    if (currentStatus === 'conflict' || currentStatus === 'unmigrated') return;
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setSyncStatus('saving');

    const expectedRevision = currentRev ?? 0;
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const snapshot = getCurrentSnapshot();

    try {
      const res = await apiSaveCloudSnapshot({
        expectedRevision,
        operationId,
        snapshot,
      });

      isSavingRef.current = false;

      if (res.status === 'saved' || res.status === 'idempotent_replay') {
        retryCountRef.current = 0;
        const newRev = res.record.revision;
        setCloudRevision(newRev);
        localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(newRev));
        localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, currentUser.id);
        setSyncStatus('idle');

        // If another save was queued while this one was in-flight, process it
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          executeSave();
        }
      } else if (res.status === 'conflict') {
        setSyncStatus('conflict');
        setConflictData({
          currentRevision: res.currentRevision,
          serverRecord: res.serverRecord,
        });
        setIsConflictModalOpen(true);
        pendingSaveRef.current = false;
      } else if (res.status === 'unauthorized') {
        setSyncStatus('auth_required');
        pendingSaveRef.current = false;
      } else {
        // Network or server error
        handleSaveError();
      }
    } catch {
      isSavingRef.current = false;
      handleSaveError();
    }
  }, [getCurrentSnapshot]);

  const handleSaveError = useCallback(() => {
    setSyncStatus('offline');
    if (retryCountRef.current < 3) {
      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current) * 1000;
      setTimeout(() => {
        if (navigator.onLine && stateRef.current.user) {
          executeSave();
        }
      }, delay);
    }
  }, [executeSave]);

  // Debounced auto-save when domain data changes
  const queueAutoSync = useCallback(() => {
    if (!isInitialLoadDoneRef.current) return;
    if (!stateRef.current.user) return;
    if (stateRef.current.syncStatus === 'conflict' || stateRef.current.syncStatus === 'unmigrated') return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSave();
    }, 600);
  }, [executeSave]);

  // Initial Authentication & Initial Cloud State Evaluation
  useEffect(() => {
    let isMounted = true;

    async function initAuthAndSync() {
      try {
        let authUser: TelegramUser | null = null;

        // 1. Try real Telegram initData first
        const rawInitData = window.Telegram?.WebApp?.initData;
        if (rawInitData && rawInitData.trim()) {
          const authRes = await apiAuthenticateTelegram(rawInitData);
          if (authRes.success && authRes.user) {
            authUser = authRes.user;
          }
        }

        // 2. If not running in Telegram WebApp or no initData, check existing session or demo
        if (!authUser) {
          const me = await apiFetchCurrentUser();
          if (me) {
            authUser = me;
          } else {
            // Attempt demo auth for browser preview
            const demoRes = await apiAuthenticateDemo();
            if (demoRes.success && demoRes.user) {
              authUser = demoRes.user;
            }
          }
        }

        if (!isMounted) return;

        if (!authUser) {
          setSyncStatus('auth_required');
          isInitialLoadDoneRef.current = true;
          return;
        }

        setUser(authUser);

        // 3. Check account isolation with previous local binding
        const boundAccountId = localStorage.getItem(STORAGE_KEY_ACCOUNT_ID);
        const localItems = getLocalItemsCount();

        if (boundAccountId && boundAccountId !== authUser.id && localItems > 0) {
          // Different account logged in with existing local data!
          setSwitchedPreviousUser(boundAccountId);
          setIsAccountSwitchModalOpen(true);
          isInitialLoadDoneRef.current = true;
          return;
        }

        // 4. Fetch cloud state
        const cloudState = await apiFetchCloudState();
        if (!isMounted) return;

        if (cloudState.isLiveDatabase !== undefined) {
          setIsLiveDatabase(cloudState.isLiveDatabase);
        }

        if (cloudState.success) {
          const record = cloudState.record;

          if (record && record.snapshot) {
            // Cloud has data
            if (localItems === 0) {
              // Local is empty -> automatically load from cloud
              importDataFromJson(JSON.stringify(record.snapshot));
              setCloudRevision(record.revision);
              localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(record.revision));
              localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, authUser.id);
              setSyncStatus('idle');
            } else {
              // Both cloud and local have data
              const localSnapshotStr = JSON.stringify(getCurrentSnapshot());
              const cloudSnapshotStr = JSON.stringify(record.snapshot);

              if (localSnapshotStr === cloudSnapshotStr) {
                // Exactly identical
                setCloudRevision(record.revision);
                localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(record.revision));
                localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, authUser.id);
                setSyncStatus('idle');
              } else {
                // Differing states -> ask user to choose (do not silently overwrite!)
                setCloudRevision(record.revision);
                setConflictData({
                  currentRevision: record.revision,
                  serverRecord: record,
                });
                setIsConflictModalOpen(true);
                setSyncStatus('conflict');
              }
            }
          } else {
            // Cloud is empty (brand new cloud account)
            if (localItems > 0) {
              // Offer migration to cloud
              setCloudRevision(0);
              setSyncStatus('unmigrated');
              setIsMigrationModalOpen(true);
            } else {
              // Both empty
              setCloudRevision(0);
              localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, '0');
              localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, authUser.id);
              setSyncStatus('idle');
            }
          }
        } else {
          setSyncStatus('offline');
        }

        isInitialLoadDoneRef.current = true;
      } catch (e) {
        console.warn('Sync initialization warning:', e);
        if (isMounted) {
          setSyncStatus('offline');
          isInitialLoadDoneRef.current = true;
        }
      }
    }

    initAuthAndSync();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Trigger auto-sync when tasks, habits, goals, expenses, activities, or settings change
  useEffect(() => {
    queueAutoSync();
  }, [tasks, habits, goals, expenses, activities, settings, queueAutoSync]);

  // Online listener to resume sync when connection restores
  useEffect(() => {
    const handleOnline = () => {
      if (stateRef.current.user && stateRef.current.syncStatus === 'offline') {
        retryCountRef.current = 0;
        executeSave();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [executeSave]);

  // Conflict Resolution: Accept Cloud Version
  const resolveConflictWithCloud = async () => {
    if (!conflictData || !conflictData.serverRecord) return;
    try {
      // 1. Export local backup automatically first to protect user data
      exportAllDataAsJson();

      // 2. Load cloud snapshot
      importDataFromJson(JSON.stringify(conflictData.serverRecord.snapshot));

      // 3. Update revision
      const rev = conflictData.serverRecord.revision;
      setCloudRevision(rev);
      localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(rev));
      if (user) localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, user.id);

      setIsConflictModalOpen(false);
      setConflictData(null);
      setSyncStatus('idle');
    } catch (err: any) {
      alert(`Xatolik: ${err?.message}`);
    }
  };

  // Conflict Resolution: Overwrite Cloud with Local Version
  const resolveConflictWithLocal = async () => {
    if (!conflictData || !user) return;
    try {
      setSyncStatus('saving');
      const operationId = `op-resolve-${Date.now()}`;
      const res = await apiSaveCloudSnapshot({
        expectedRevision: conflictData.currentRevision,
        operationId,
        snapshot: getCurrentSnapshot(),
      });

      if (res.status === 'saved' || res.status === 'idempotent_replay') {
        const newRev = res.record.revision;
        setCloudRevision(newRev);
        localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(newRev));
        localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, user.id);
        setIsConflictModalOpen(false);
        setConflictData(null);
        setSyncStatus('idle');
      } else if (res.status === 'conflict') {
        setConflictData({
          currentRevision: res.currentRevision,
          serverRecord: res.serverRecord,
        });
      } else {
        alert('Serverga saqlashda xatolik yuz berdi.');
      }
    } catch (err: any) {
      alert(`Xatolik: ${err?.message}`);
    }
  };

  // Confirm Migration of Local Data to Cloud
  const confirmMigrationToCloud = async () => {
    if (!user) return;
    try {
      setSyncStatus('saving');
      const operationId = `op-migrate-${Date.now()}`;
      const res = await apiSaveCloudSnapshot({
        expectedRevision: 0,
        operationId,
        snapshot: getCurrentSnapshot(),
      });

      if (res.status === 'saved' || res.status === 'idempotent_replay') {
        const newRev = res.record.revision;
        setCloudRevision(newRev);
        localStorage.setItem(STORAGE_KEY_CLOUD_REVISION, String(newRev));
        localStorage.setItem(STORAGE_KEY_ACCOUNT_ID, user.id);
        setIsMigrationModalOpen(false);
        setSyncStatus('idle');
      } else {
        alert('Bulutga ko‘chirishda xatolik yuz berdi.');
        setSyncStatus('unmigrated');
      }
    } catch (err: any) {
      alert(`Ko‘chirishda xatolik: ${err?.message}`);
      setSyncStatus('unmigrated');
    }
  };

  const closeConflictModal = () => setIsConflictModalOpen(false);
  const closeMigrationModal = () => setIsMigrationModalOpen(false);
  const dismissAccountSwitchNotice = () => setIsAccountSwitchModalOpen(false);

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        cloudRevision,
        user,
        isLiveDatabase,
        conflictData,
        isMigrationModalOpen,
        isConflictModalOpen,
        isAccountSwitchModalOpen,
        switchedPreviousUser,
        triggerSyncNow: executeSave,
        resolveConflictWithCloud,
        resolveConflictWithLocal,
        confirmMigrationToCloud,
        closeConflictModal,
        closeMigrationModal,
        dismissAccountSwitchNotice,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
};
