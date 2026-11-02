-- ==============================================================================
-- Kunlik Yordamchi - PostgreSQL / Supabase Migration
-- Table: user_snapshots
-- Stores verified domain snapshots per Telegram user with optimistic concurrency
-- and idempotency support.
-- ==============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.user_snapshots (
    user_id TEXT PRIMARY KEY,
    telegram_username TEXT,
    telegram_first_name TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    revision BIGINT NOT NULL DEFAULT 1,
    last_operation_id TEXT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_snapshots_revision_positive CHECK (revision > 0),
    CONSTRAINT user_snapshots_schema_version_positive CHECK (schema_version > 0)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_snapshots_updated_at 
    ON public.user_snapshots(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_snapshots_last_operation 
    ON public.user_snapshots(user_id, last_operation_id);

-- 3. Row Level Security (RLS)
-- CRITICAL SECURITY REQUIREMENT:
-- Clients (browser / Telegram WebApp) must NEVER connect directly to PostgreSQL.
-- All database operations are mediated solely by the backend server using the Supabase Service Role key.
-- We enable RLS and create NO permissive policies for anon or authenticated roles,
-- which completely blocks direct client-side read/write.
ALTER TABLE public.user_snapshots ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions from public, anon, and authenticated roles
REVOKE ALL ON TABLE public.user_snapshots FROM PUBLIC;
REVOKE ALL ON TABLE public.user_snapshots FROM anon;
REVOKE ALL ON TABLE public.user_snapshots FROM authenticated;

-- Grant access strictly to service_role (used exclusively by our Node.js server)
GRANT ALL ON TABLE public.user_snapshots TO service_role;

-- 4. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_snapshots_updated_at ON public.user_snapshots;
CREATE TRIGGER trigger_user_snapshots_updated_at
    BEFORE UPDATE ON public.user_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 5. Atomic conditional save function (optimistic concurrency + idempotency)
CREATE OR REPLACE FUNCTION public.save_user_snapshot(
    p_user_id TEXT,
    p_expected_revision BIGINT,
    p_operation_id TEXT,
    p_snapshot JSONB,
    p_schema_version INTEGER DEFAULT 1,
    p_username TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_existing public.user_snapshots%ROWTYPE;
    v_updated public.user_snapshots%ROWTYPE;
BEGIN
    -- Lock row for update if it exists
    SELECT * INTO v_existing 
    FROM public.user_snapshots 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    -- Scenario 1: Record already exists
    IF FOUND THEN
        -- Check 1A: Idempotency replay with same operation_id
        IF p_operation_id IS NOT NULL AND v_existing.last_operation_id = p_operation_id THEN
            RETURN jsonb_build_object(
                'status', 'idempotent_replay',
                'record', to_jsonb(v_existing)
            );
        END IF;

        -- Check 1B: Revision mismatch (Optimistic concurrency conflict)
        IF v_existing.revision != p_expected_revision THEN
            RETURN jsonb_build_object(
                'status', 'conflict',
                'currentRevision', v_existing.revision,
                'serverRecord', to_jsonb(v_existing)
            );
        END IF;

        -- Revision matches -> update atomically with incremented revision
        UPDATE public.user_snapshots
        SET 
            snapshot = p_snapshot,
            revision = v_existing.revision + 1,
            schema_version = p_schema_version,
            last_operation_id = p_operation_id,
            telegram_username = COALESCE(p_username, v_existing.telegram_username),
            telegram_first_name = COALESCE(p_first_name, v_existing.telegram_first_name),
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING * INTO v_updated;

        RETURN jsonb_build_object(
            'status', 'saved',
            'record', to_jsonb(v_updated)
        );

    -- Scenario 2: First-time write for this user
    ELSE
        -- Expected revision must be 0 for initial creation
        IF p_expected_revision IS NOT NULL AND p_expected_revision != 0 THEN
            RETURN jsonb_build_object(
                'status', 'conflict',
                'currentRevision', 0,
                'serverRecord', NULL
            );
        END IF;

        INSERT INTO public.user_snapshots (
            user_id,
            telegram_username,
            telegram_first_name,
            schema_version,
            revision,
            last_operation_id,
            snapshot,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_username,
            p_first_name,
            p_schema_version,
            1,
            p_operation_id,
            p_snapshot,
            NOW(),
            NOW()
        )
        RETURNING * INTO v_updated;

        RETURN jsonb_build_object(
            'status', 'saved',
            'record', to_jsonb(v_updated)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
