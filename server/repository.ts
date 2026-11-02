import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IUserStateRepository,
  UserSnapshotRecord,
  SaveSnapshotInput,
  SaveSnapshotResult,
} from './types';

/**
 * In-Memory User State Repository.
 * Provides exact atomic optimistic concurrency and idempotency semantics.
 * Used during testing and when live PostgreSQL / Supabase credentials are not yet configured in .env.
 */
export class InMemoryUserStateRepository implements IUserStateRepository {
  private records = new Map<string, UserSnapshotRecord>();

  isLiveDatabase(): boolean {
    return false;
  }

  async get(userId: string): Promise<UserSnapshotRecord | null> {
    const rec = this.records.get(userId);
    if (!rec) return null;
    // Deep clone to prevent accidental outside mutation
    return JSON.parse(JSON.stringify(rec));
  }

  async save(userId: string, input: SaveSnapshotInput): Promise<SaveSnapshotResult> {
    const existing = this.records.get(userId);

    // 1. Existing record
    if (existing) {
      // 1A. Idempotency replay
      if (input.operationId && existing.lastOperationId === input.operationId) {
        return {
          status: 'idempotent_replay',
          isIdempotentReplay: true,
          record: JSON.parse(JSON.stringify(existing)),
        };
      }

      // 1B. Optimistic concurrency conflict check
      if (existing.revision !== input.expectedRevision) {
        return {
          status: 'conflict',
          currentRevision: existing.revision,
          serverRecord: JSON.parse(JSON.stringify(existing)),
        };
      }

      // 1C. Successful atomic update
      const updated: UserSnapshotRecord = {
        userId,
        telegramUsername: input.username || existing.telegramUsername,
        telegramFirstName: input.firstName || existing.telegramFirstName,
        schemaVersion: input.schemaVersion ?? 1,
        revision: existing.revision + 1,
        lastOperationId: input.operationId,
        snapshot: JSON.parse(JSON.stringify(input.snapshot)),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };

      this.records.set(userId, updated);
      return {
        status: 'saved',
        record: JSON.parse(JSON.stringify(updated)),
      };
    }

    // 2. New record (initial save for user)
    if (input.expectedRevision !== 0 && input.expectedRevision !== null) {
      return {
        status: 'conflict',
        currentRevision: 0,
        serverRecord: null,
      };
    }

    const created: UserSnapshotRecord = {
      userId,
      telegramUsername: input.username,
      telegramFirstName: input.firstName,
      schemaVersion: input.schemaVersion ?? 1,
      revision: 1,
      lastOperationId: input.operationId,
      snapshot: JSON.parse(JSON.stringify(input.snapshot)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(userId, created);
    return {
      status: 'saved',
      record: JSON.parse(JSON.stringify(created)),
    };
  }

  // Helper for test resets
  clear(): void {
    this.records.clear();
  }
}

/**
 * Supabase PostgreSQL User State Repository.
 * Communicates strictly using the Supabase Service Role Key on the server.
 */
export class SupabaseUserStateRepository implements IUserStateRepository {
  private client: SupabaseClient;
  private demoFallbackRepo = new InMemoryUserStateRepository();

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  isLiveDatabase(): boolean {
    return true;
  }

  async get(userId: string): Promise<UserSnapshotRecord | null> {
    // Isolate preview demo user from real PostgreSQL tables
    if (userId === 'demo-preview-user') {
      return this.demoFallbackRepo.get(userId);
    }

    const { data, error } = await this.client
      .from('user_snapshots')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase dan ma‘lumot olishda xatolik: ${error.message}`);
    }

    if (!data) return null;

    return {
      userId: data.user_id,
      telegramUsername: data.telegram_username,
      telegramFirstName: data.telegram_first_name,
      schemaVersion: data.schema_version,
      revision: Number(data.revision),
      lastOperationId: data.last_operation_id,
      snapshot: data.snapshot,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async save(userId: string, input: SaveSnapshotInput): Promise<SaveSnapshotResult> {
    // Isolate preview demo user from real PostgreSQL tables
    if (userId === 'demo-preview-user') {
      return this.demoFallbackRepo.save(userId, input);
    }

    // Attempt to invoke the atomic PostgreSQL stored procedure first
    const { data: rpcData, error: rpcError } = await this.client.rpc('save_user_snapshot', {
      p_user_id: userId,
      p_expected_revision: input.expectedRevision,
      p_operation_id: input.operationId,
      p_snapshot: input.snapshot,
      p_schema_version: input.schemaVersion || 1,
      p_username: input.username || null,
      p_first_name: input.firstName || null,
    });

    if (!rpcError && rpcData) {
      if (rpcData.status === 'idempotent_replay') {
        const raw = rpcData.record;
        return {
          status: 'idempotent_replay',
          isIdempotentReplay: true,
          record: {
            userId: raw.user_id,
            telegramUsername: raw.telegram_username,
            telegramFirstName: raw.telegram_first_name,
            schemaVersion: raw.schema_version,
            revision: Number(raw.revision),
            lastOperationId: raw.last_operation_id,
            snapshot: raw.snapshot,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
          },
        };
      }

      if (rpcData.status === 'conflict') {
        const raw = rpcData.serverRecord;
        return {
          status: 'conflict',
          currentRevision: Number(rpcData.currentRevision),
          serverRecord: raw
            ? {
                userId: raw.user_id,
                telegramUsername: raw.telegram_username,
                telegramFirstName: raw.telegram_first_name,
                schemaVersion: raw.schema_version,
                revision: Number(raw.revision),
                lastOperationId: raw.last_operation_id,
                snapshot: raw.snapshot,
                createdAt: raw.created_at,
                updatedAt: raw.updated_at,
              }
            : null,
        };
      }

      if (rpcData.status === 'saved' && rpcData.record) {
        const raw = rpcData.record;
        return {
          status: 'saved',
          record: {
            userId: raw.user_id,
            telegramUsername: raw.telegram_username,
            telegramFirstName: raw.telegram_first_name,
            schemaVersion: raw.schema_version,
            revision: Number(raw.revision),
            lastOperationId: raw.last_operation_id,
            snapshot: raw.snapshot,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
          },
        };
      }
    }

    // Direct table query fallback if RPC function was not created yet
    const existing = await this.get(userId);

    if (existing) {
      if (input.operationId && existing.lastOperationId === input.operationId) {
        return {
          status: 'idempotent_replay',
          isIdempotentReplay: true,
          record: existing,
        };
      }

      if (existing.revision !== input.expectedRevision) {
        return {
          status: 'conflict',
          currentRevision: existing.revision,
          serverRecord: existing,
        };
      }

      const nextRevision = existing.revision + 1;
      const { data: updated, error: updateError } = await this.client
        .from('user_snapshots')
        .update({
          snapshot: input.snapshot,
          revision: nextRevision,
          schema_version: input.schemaVersion || 1,
          last_operation_id: input.operationId,
          telegram_username: input.username || existing.telegramUsername,
          telegram_first_name: input.firstName || existing.telegramFirstName,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('revision', input.expectedRevision)
        .select()
        .single();

      if (updateError || !updated) {
        // Concurrency collision occurred during update
        const latest = await this.get(userId);
        return {
          status: 'conflict',
          currentRevision: latest?.revision || existing.revision,
          serverRecord: latest,
        };
      }

      return {
        status: 'saved',
        record: {
          userId: updated.user_id,
          telegramUsername: updated.telegram_username,
          telegramFirstName: updated.telegram_first_name,
          schemaVersion: updated.schema_version,
          revision: Number(updated.revision),
          lastOperationId: updated.last_operation_id,
          snapshot: updated.snapshot,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      };
    } else {
      if (input.expectedRevision !== 0 && input.expectedRevision !== null) {
        return {
          status: 'conflict',
          currentRevision: 0,
          serverRecord: null,
        };
      }

      const { data: inserted, error: insertError } = await this.client
        .from('user_snapshots')
        .insert({
          user_id: userId,
          telegram_username: input.username,
          telegram_first_name: input.firstName,
          schema_version: input.schemaVersion || 1,
          revision: 1,
          last_operation_id: input.operationId,
          snapshot: input.snapshot,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        const latest = await this.get(userId);
        return {
          status: 'conflict',
          currentRevision: latest?.revision || 0,
          serverRecord: latest,
        };
      }

      return {
        status: 'saved',
        record: {
          userId: inserted.user_id,
          telegramUsername: inserted.telegram_username,
          telegramFirstName: inserted.telegram_first_name,
          schemaVersion: inserted.schema_version,
          revision: Number(inserted.revision),
          lastOperationId: inserted.last_operation_id,
          snapshot: inserted.snapshot,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        },
      };
    }
  }
}

let repositoryInstance: IUserStateRepository | null = null;

export function getRepository(): IUserStateRepository {
  if (repositoryInstance) return repositoryInstance;

  const isProd = process.env.NODE_ENV === 'production';
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('MY_SUPABASE')) {
    try {
      repositoryInstance = new SupabaseUserStateRepository(supabaseUrl, serviceRoleKey);
      console.log('✅ [Repository] Supabase PostgreSQL repository muvaffaqiyatli ulandi.');
      return repositoryInstance;
    } catch (e: any) {
      if (isProd) {
        throw new Error(`[FATAL DATABASE ERROR] Production muhitida Supabase PostgreSQL ga ulanib bo‘lmadi: ${e?.message}`);
      }
      console.warn('⚠️ [Repository] Supabase ulanishida xatolik, in-memory repository ishlatiladi (faqat dev/test):', e?.message);
    }
  }

  // In production, fallback to in-memory repository is strictly forbidden
  if (isProd) {
    throw new Error(
      '[FATAL CONFIG] Production muhitida SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY to‘liq sozlanishi shart! In-Memory fallback productionda qat‘iyan taqiqlangan.'
    );
  }

  console.log('ℹ️ [Repository] Supabase ma‘lumotlari topilmadi. In-Memory transactional repository ishlatilmoqda (faqat dev/test rejimida).');
  repositoryInstance = new InMemoryUserStateRepository();
  return repositoryInstance;
}

export function setTestRepository(repo: IUserStateRepository | null): void {
  repositoryInstance = repo;
}
