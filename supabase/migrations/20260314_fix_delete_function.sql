-- Fix: Drop old delete_user_cascade signatures before creating new one
DROP FUNCTION IF EXISTS delete_user_cascade(UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS delete_user_cascade(UUID);

CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
  v_instance_id TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = target_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT instance_id INTO v_instance_id FROM profiles WHERE id = target_user_id;

  DELETE FROM agent_instances WHERE user_id = target_user_id;
  BEGIN DELETE FROM agent_tasks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM conversations WHERE user_id = target_user_id;
  DELETE FROM memories WHERE user_id = target_user_id;
  BEGIN DELETE FROM user_secrets WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM file_chunks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM files WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM user_integrations WHERE user_id = target_user_id;
  BEGIN DELETE FROM oauth_flows WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM installed_skills WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM workflow_runs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM workflow_memory WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM workflows WHERE user_id = target_user_id;
  BEGIN DELETE FROM activity_log WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM token_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_history WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM daily_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM instructions WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_gateways WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_context WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM onboarding_state WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM cron_jobs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Log deletion (non-fatal: skip gracefully if table doesn't exist yet)
  BEGIN
    INSERT INTO account_deletion_log (user_id, user_email, instance_id, deletion_type, deleted_by, metadata)
    VALUES (target_user_id, v_user_email, v_instance_id, 'full_delete', target_user_id,
      jsonb_build_object('had_instance', v_instance_id IS NOT NULL));
  EXCEPTION WHEN undefined_table THEN
    -- account_deletion_log not yet created; skip silently
    NULL;
  END;

  DELETE FROM profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'deletion_type', 'full_delete', 'user_email', v_user_email);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_user_cascade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_cascade(UUID) TO service_role;
