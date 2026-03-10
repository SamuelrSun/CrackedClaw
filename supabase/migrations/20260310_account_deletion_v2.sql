-- Account Deletion V2 — covers ALL tables including mem0, agents, skills, files
-- Replaces the old delete_user_cascade function

CREATE OR REPLACE FUNCTION delete_user_cascade(
  target_user_id UUID,
  delete_instance BOOLEAN DEFAULT false,
  provisioning_api_url TEXT DEFAULT NULL,
  provisioning_api_secret TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_org RECORD;
  v_member_count INTEGER;
  v_user_email TEXT;
  v_deletion_type TEXT;
  v_instance_deleted BOOLEAN := false;
BEGIN
  -- Get user email for logging
  SELECT email INTO v_user_email FROM auth.users WHERE id = target_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Get user's organization (as owner)
  SELECT * INTO v_org FROM organizations WHERE owner_id = target_user_id;

  IF v_org.id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_member_count
    FROM team_members
    WHERE org_id = v_org.id
    AND user_id != target_user_id
    AND accepted_at IS NOT NULL;

    IF v_member_count > 0 THEN
      v_deletion_type := 'leave_org';
      -- Transfer ownership to next admin/member
      UPDATE organizations SET owner_id = (
        SELECT user_id FROM team_members
        WHERE org_id = v_org.id AND user_id != target_user_id AND accepted_at IS NOT NULL
        ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, created_at ASC
        LIMIT 1
      ) WHERE id = v_org.id;
      -- Remove user from team
      DELETE FROM team_members WHERE user_id = target_user_id AND org_id = v_org.id;
    ELSE
      v_deletion_type := 'delete_org';
      IF delete_instance AND v_org.openclaw_instance_id IS NOT NULL THEN
        v_instance_deleted := true;
      END IF;
      DELETE FROM organizations WHERE id = v_org.id;  -- cascades team_members, team_invitations
    END IF;
  ELSE
    v_deletion_type := 'solo';
  END IF;

  -- =============================================
  -- DELETE ALL USER DATA (children before parents)
  -- =============================================

  -- Agent system (agent_messages cascades from agent_instances FK)
  DELETE FROM agent_instances WHERE user_id = target_user_id;
  -- agent_tasks may not have FK cascade
  BEGIN DELETE FROM agent_tasks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Chat (messages + conversation_links cascade from conversations FK)
  DELETE FROM conversations WHERE user_id = target_user_id;

  -- Memory — ALL systems
  DELETE FROM memories WHERE user_id = target_user_id;           -- mem0 pgvector
  BEGIN DELETE FROM user_memory WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;  -- legacy
  BEGIN DELETE FROM user_secrets WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;  -- encrypted creds

  -- Files
  BEGIN DELETE FROM file_chunks WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM files WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Integrations
  DELETE FROM user_integrations WHERE user_id = target_user_id;
  BEGIN DELETE FROM oauth_flows WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Skills
  BEGIN DELETE FROM installed_skills WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Workflows (workflow_runs may cascade from workflows FK)
  BEGIN DELETE FROM workflow_runs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM workflow_memory WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM workflows WHERE user_id = target_user_id;

  -- Usage & activity
  BEGIN DELETE FROM activity_log WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM token_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM usage_history WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM daily_usage WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Config & state
  BEGIN DELETE FROM instructions WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_gateways WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM user_context WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM onboarding_state WHERE user_id = target_user_id;

  -- Team memberships (if user is member of OTHER orgs)
  DELETE FROM team_members WHERE user_id = target_user_id;

  -- Profile
  DELETE FROM profiles WHERE id = target_user_id;

  -- Log the deletion
  INSERT INTO account_deletion_log (
    user_id, user_email, organization_id, organization_name,
    instance_id, instance_deleted, deletion_type, deleted_by, metadata
  ) VALUES (
    target_user_id, v_user_email, v_org.id, v_org.name,
    v_org.openclaw_instance_id, v_instance_deleted, v_deletion_type, target_user_id,
    jsonb_build_object('member_count', COALESCE(v_member_count, 0), 'had_instance', v_org.openclaw_instance_id IS NOT NULL)
  );

  -- Delete auth user (triggers any remaining FK cascades)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deletion_type', v_deletion_type,
    'instance_deleted', v_instance_deleted,
    'organization_deleted', v_deletion_type = 'delete_org',
    'user_email', v_user_email
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_user_cascade FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_cascade TO service_role;
