import { db, DeploymentRow, ProjectRow, UserRow } from './db';
import { decrypt, randomId, newProjectId } from './crypto';
import { UserError } from './http';
import { cleanFiles, detectFramework } from './files';
import { commitSnapshot, createRepo } from './github';
import {
  createDeployment,
  createVercelProject,
  getBuildLogTail,
  getDeployment,
  pickProductionAlias,
  upsertEnv,
} from './vercel';
import { appUrl } from './env';
import { slugify } from './util';

const TERMINAL = new Set(['READY', 'ERROR', 'CANCELED']);

export type PublishInput = {
  files: unknown;
  project_id?: string;
  name?: string;
  message?: string;
  private?: boolean;
};

function vercelCreds(user: UserRow) {
  if (!user.vercel_token_enc) {
    throw new UserError(`Vercel isn't connected yet. Connect it at ${appUrl()}/dashboard, then publish again.`, 412);
  }
  return { token: decrypt(user.vercel_token_enc), teamId: user.vercel_team_id };
}

export async function getOwnedProject(userId: string, projectId: string): Promise<ProjectRow> {
  const id = String(projectId || '').trim();
  const { data } = await db().from('projects').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!data) {
    throw new UserError(`No project "${id}" on this account. Omit project_id to create a new project, or call list_projects.`, 404);
  }
  return data as ProjectRow;
}

async function createProjectFor(
  user: UserRow,
  ghToken: string,
  vercel: { token: string; teamId: string | null },
  input: PublishInput,
  framework: string | null,
): Promise<ProjectRow> {
  const base = slugify(input.name);
  const id = newProjectId();
  const candidates = [base, `${base}-${id.slice(3, 7)}`, `${base}-${randomId(6)}`];

  let repo: { fullName: string; defaultBranch: string } | null = null;
  for (const name of candidates) {
    repo = await createRepo(ghToken, name, input.private !== false, `Published with CodeLink (${id})`);
    if (repo) break;
  }
  if (!repo) throw new UserError('Could not find a free GitHub repo name. Pass a different "name".', 409);

  let vp: { id: string; name: string } | null = null;
  for (const name of candidates) {
    vp = await createVercelProject(vercel.token, vercel.teamId, name, framework);
    if (vp) break;
  }
  if (!vp) throw new UserError('Could not find a free Vercel project name. Pass a different "name".', 409);

  const row = {
    id,
    user_id: user.id,
    name: base,
    github_repo: repo.fullName,
    github_default_branch: repo.defaultBranch,
    vercel_project_id: vp.id,
    vercel_project_name: vp.name,
  };
  const { data, error } = await db().from('projects').insert(row).select('*').single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function publish(user: UserRow, input: PublishInput) {
  const vercel = vercelCreds(user);
  const { files, skipped } = cleanFiles(input.files);
  const ghToken = decrypt(user.github_token_enc);
  const framework = detectFramework(files);

  const project = input.project_id
    ? await getOwnedProject(user.id, input.project_id)
    : await createProjectFor(user, ghToken, vercel, input, framework);

  const message = (typeof input.message === 'string' && input.message.trim()) || 'Publish via CodeLink';
  const sha = await commitSnapshot(ghToken, project.github_repo, project.github_default_branch, files, message.slice(0, 500));

  let deployment;
  try {
    deployment = await createDeployment(vercel.token, vercel.teamId, {
      projectId: project.vercel_project_id,
      projectName: project.vercel_project_name,
      files,
      framework,
      commitSha: sha,
      repo: project.github_repo,
    });
  } catch (e) {
    await db().from('deployments').insert({
      project_id: project.id,
      commit_sha: sha,
      commit_message: message,
      status: 'ERROR',
      error: e instanceof Error ? e.message : String(e),
      file_count: files.length,
    });
    throw e;
  }

  const status = deployment.readyState || 'QUEUED';
  const deploymentUrl = `https://${deployment.url}`;
  await db().from('deployments').insert({
    project_id: project.id,
    vercel_deployment_id: deployment.id,
    commit_sha: sha,
    commit_message: message,
    status,
    url: deploymentUrl,
    file_count: files.length,
  });
  await db().from('projects').update({ updated_at: new Date().toISOString() }).eq('id', project.id);

  return {
    project_id: project.id,
    status,
    deployment_url: deploymentUrl,
    live_url: project.production_url,
    repo_url: `https://github.com/${project.github_repo}`,
    dashboard_url: `${appUrl()}/dashboard/projects/${project.id}`,
    commit: sha,
    framework: framework ?? 'static',
    files_published: files.length,
    skipped,
    next_step: `Building now (usually 30–90 seconds). Call get_status with project_id "${project.id}" to get the live URL or build errors. Reuse this project_id to publish updates.`,
  };
}

export async function getStatus(user: UserRow, projectId: string) {
  const project = await getOwnedProject(user.id, projectId);
  const { data } = await db()
    .from('deployments')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = data as DeploymentRow | null;

  if (latest?.vercel_deployment_id && !TERMINAL.has(latest.status) && user.vercel_token_enc) {
    const { token, teamId } = vercelCreds(user);
    const d = await getDeployment(token, teamId, latest.vercel_deployment_id);
    const patch: Partial<DeploymentRow> = { status: d.readyState };
    if (d.readyState === 'ERROR') {
      const logs = await getBuildLogTail(token, teamId, latest.vercel_deployment_id).catch(() => '');
      patch.error = [d.errorMessage, logs].filter(Boolean).join('\n\n').slice(0, 8000) || 'Build failed';
    }
    await db().from('deployments').update(patch).eq('id', latest.id);
    Object.assign(latest, patch);

    if (d.readyState === 'READY') {
      const prod = pickProductionAlias(d.alias);
      if (prod && prod !== project.production_url) {
        await db().from('projects').update({ production_url: prod }).eq('id', project.id);
        project.production_url = prod;
      }
    }
  }

  const status = latest?.status ?? 'NO_DEPLOYMENTS';
  const hint =
    status === 'READY'
      ? 'Live.'
      : status === 'ERROR'
        ? 'Build failed. Read "error", fix the code, and call publish again with the same project_id.'
        : status === 'NO_DEPLOYMENTS'
          ? 'Nothing published yet.'
          : 'Still building. Check again in about 15 seconds.';

  return {
    project_id: project.id,
    name: project.name,
    status,
    live_url: status === 'READY' ? (project.production_url ?? latest?.url ?? null) : project.production_url,
    deployment_url: latest?.url ?? null,
    repo_url: `https://github.com/${project.github_repo}`,
    last_commit: latest?.commit_sha ?? null,
    last_published_at: latest?.created_at ?? null,
    error: latest?.status === 'ERROR' ? latest.error : undefined,
    hint,
  };
}

export async function setEnv(user: UserRow, projectId: string, key: unknown, value: unknown) {
  const project = await getOwnedProject(user.id, projectId);
  if (typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new UserError('key must look like MY_SECRET (letters, digits, underscores)');
  }
  if (typeof value !== 'string') throw new UserError('value must be a string');
  const { token, teamId } = vercelCreds(user);
  await upsertEnv(token, teamId, project.vercel_project_id, key, value);
  return { ok: true, project_id: project.id, key, note: 'Saved. It takes effect on the next publish.' };
}

export async function listProjects(user: UserRow) {
  const { data: projects } = await db()
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100);
  const rows = (projects ?? []) as ProjectRow[];
  if (!rows.length) return [];

  const { data: deps } = await db()
    .from('deployments')
    .select('project_id,status,url,created_at')
    .in('project_id', rows.map((p) => p.id))
    .order('created_at', { ascending: false });
  const latest = new Map<string, any>();
  for (const d of deps ?? []) if (!latest.has(d.project_id)) latest.set(d.project_id, d);

  return rows.map((p) => ({
    project_id: p.id,
    name: p.name,
    status: latest.get(p.id)?.status ?? 'NO_DEPLOYMENTS',
    live_url: p.production_url ?? latest.get(p.id)?.url ?? null,
    repo_url: `https://github.com/${p.github_repo}`,
    updated_at: p.updated_at,
  }));
}
