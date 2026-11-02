-- ==============================================================================
-- Kunlik Yordamchi - PostgreSQL / Supabase Hotfix Migration
-- File: 20261102_secure_save_user_snapshot.sql
-- Fixes:
-- 1. Restricts save_user_snapshot SECURITY DEFINER execution to service_role ONLY.
-- 2. Revokes execution from PUBLIC, anon, and authenticated roles.
-- 3. Sets strict search_path = public, pg_temp to prevent search_path hijacking.
-- ==============================================================================

-- 1. Re-declare save_user_snapshot with strict search_path and schema-qualified references
CREATE OR REPLACE FUNCTION public.save_user_snapshot(
    p_user_id TEXT,
    p_expected_revision BIGINT,
    p_operation_id TEXT,
    p_snapshot JSONB,
    p_schema_version INTEGER DEFAULT 1,
    p_username TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing public.user_snapshots%ROWTYPE;
    v_updated public.user_snapshots%ROWTYPE;
BEGIN
    -- Explicitly verify input parameters
    IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
        RAISE EXCEPTION 'p_user_id bo''sh bo''lishi mumkin emas.';
    END IF;

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
$$;

-- 2. Revoke execute privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.save_user_snapshot(TEXT, BIGINT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_snapshot(TEXT, BIGINT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.save_user_snapshot(TEXT, BIGINT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM authenticated;

-- 3. Grant execute strictly and exclusively to service_role (backend server only)
GRANT EXECUTE ON FUNCTION public.save_user_snapshot(TEXT, BIGINT, TEXT, JSONB, INTEGER, TEXT, TEXT) TO service_role;
