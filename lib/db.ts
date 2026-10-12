import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/** Server-only Supabase client (service role). Never import from client components. */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type UserRow = {
  id: string;
  github_id: number;
  github_login: string;
  avatar_url: string | null;
  github_token_enc: string;
  vercel_token_enc: string | null;
  vercel_team_id: string | null;
  vercel_username: string | null;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  github_repo: string;
  github_default_branch: string;
  vercel_project_id: string;
  vercel_project_name: string;
  production_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentRow = {
  id: string;
  project_id: string;
  vercel_deployment_id: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  status: string;
  url: string | null;
  error: string | null;
  file_count: number | null;
  created_at: string;
};
