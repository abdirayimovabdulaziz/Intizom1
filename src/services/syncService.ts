import { UserSnapshot, UserSnapshotRecord, TelegramUser } from '../../server/types';

export type SyncStatus =
  | 'idle' // Saqlandi / Sinxronlangan
  | 'saving' // Saqlanmoqda...
  | 'offline' // Internet yo‘q — qurilmada saqlandi
  | 'conflict' // Sinxronizatsiyada ziddiyat
  | 'auth_required' // Kirish talab qilinadi
  | 'unmigrated'; // Lokal ma'lumotni bulutga ko'chirish taklif etilmoqda

export interface ConflictData {
  currentRevision: number;
  serverRecord: UserSnapshotRecord | null;
}

export const STORAGE_KEY_ACCOUNT_ID = 'kunlik_bound_telegram_account_id';
export const STORAGE_KEY_CLOUD_REVISION = 'kunlik_cloud_revision';

/**
 * Sends raw Telegram initData to backend for HMAC-SHA256 signature verification.
 */
export async function apiAuthenticateTelegram(initData: string): Promise<{
  success: boolean;
  user?: TelegramUser;
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ initData }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Telegram autentifikatsiyasidan o‘tib bo‘lmadi.' };
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Tarmoq xatosi.' };
  }
}

/**
 * Requests demo session when testing outside Telegram WebApp.
 */
export async function apiAuthenticateDemo(): Promise<{
  success: boolean;
  user?: TelegramUser;
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/demo-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Demo sessiya ochib bo‘lmadi.' };
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Tarmoq xatosi.' };
  }
}

/**
 * Checks current server session.
 */
export async function apiFetchCurrentUser(): Promise<TelegramUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

/**
 * Fetches user cloud state record.
 */
export async function apiFetchCloudState(): Promise<{
  success: boolean;
  record: UserSnapshotRecord | null;
  isLiveDatabase?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/sync/state', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (res.status === 401) {
      return { success: false, record: null, error: 'UNAUTHORIZED' };
    }

    const data = await res.json();
    if (!res.ok) {
      return { success: false, record: null, error: data.error || 'Holatni olib bo‘lmadi.' };
    }

    return {
      success: true,
      record: data.record,
      isLiveDatabase: data.isLiveDatabase,
    };
  } catch (err: any) {
    return { success: false, record: null, error: err?.message || 'Tarmoq xatosi.' };
  }
}

export type SaveApiResponse =
  | { status: 'saved'; record: UserSnapshotRecord }
  | { status: 'idempotent_replay'; record: UserSnapshotRecord }
  | { status: 'conflict'; currentRevision: number; serverRecord: UserSnapshotRecord | null }
  | { status: 'unauthorized' }
  | { status: 'error'; error: string };

/**
 * Saves user snapshot atomically with optimistic concurrency control.
 */
export async function apiSaveCloudSnapshot(params: {
  expectedRevision: number;
  operationId: string;
  snapshot: UserSnapshot;
}): Promise<SaveApiResponse> {
  try {
    const res = await fetch('/api/sync/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(params),
    });

    if (res.status === 401) {
      return { status: 'unauthorized' };
    }

    const data = await res.json();

    if (res.status === 409) {
      return {
        status: 'conflict',
        currentRevision: data.currentRevision,
        serverRecord: data.serverRecord,
      };
    }

    if (!res.ok) {
      return {
        status: 'error',
        error: data.error || 'Saqlashda xatolik yuz berdi.',
      };
    }

    if (data.status === 'idempotent_replay') {
      return {
        status: 'idempotent_replay',
        record: data.record,
      };
    }

    return {
      status: 'saved',
      record: data.record,
    };
  } catch (err: any) {
    return {
      status: 'error',
      error: err?.message || 'Tarmoq xatosi.',
    };
  }
}
