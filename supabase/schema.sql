-- CodeLink schema. Run in the Supabase SQL editor.
-- All access goes through the server with the service role key, so RLS is
-- enabled with no policies: the anon key can read nothing.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null,
  github_login text not null,
  avatar_url text,
  github_token_enc text not null,
  vercel_token_enc text,
  vercel_team_id text,
  vercel_username text,
  created_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  key_hash text unique not null,
  key_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,                       -- cl_xxxxxxxx
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  github_repo text not null,                 -- owner/name
  github_default_branch text not null default 'main',
  vercel_project_id text not null,
  vercel_project_name text not null,
  production_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  vercel_deployment_id text,
  commit_sha text,
  commit_message text,
  status text not null default 'QUEUED',
  url text,
  error text,
  file_count int,
  created_at timestamptz not null default now()
);

create index if not exists deployments_project_created on deployments(project_id, created_at desc);
create index if not exists projects_user on projects(user_id, updated_at desc);
create index if not exists api_keys_user on api_keys(user_id);

alter table users enable row level security;
alter table api_keys enable row level security;
alter table projects enable row level security;
alter table deployments enable row level security;
