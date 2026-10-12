import { UpstreamError } from './http';
import { CleanFile } from './files';

const API = 'https://api.vercel.com';

async function vc<T = any>(token: string, teamId: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(API + path);
  if (teamId) url.searchParams.set('teamId', teamId);
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error?.message || msg;
    } catch {}
    throw new UpstreamError('Vercel', res.status, msg);
  }
  return res.json();
}

/** Throws if the token (and team, if given) isn't usable. Returns the Vercel username. */
export async function verifyVercel(token: string, teamId: string | null): Promise<string> {
  const u = await vc(token, null, '/v2/user');
  if (teamId) await vc(token, null, `/v2/teams/${encodeURIComponent(teamId)}`);
  return u.user?.username ?? 'unknown';
}

/** Returns null when the name is taken. */
export async function createVercelProject(token: string, teamId: string | null, name: string, framework: string | null) {
  try {
    const p = await vc(token, teamId, '/v10/projects', { method: 'POST', body: JSON.stringify({ name, framework }) });
    return { id: p.id as string, name: p.name as string };
  } catch (e) {
    if (e instanceof UpstreamError && (e.status === 409 || /already exists/i.test(e.message))) return null;
    throw e;
  }
}

export async function createDeployment(
  token: string,
  teamId: string | null,
  opts: { projectId: string; projectName: string; files: CleanFile[]; framework: string | null; commitSha: string; repo: string },
) {
  return vc<{ id: string; url: string; readyState?: string }>(token, teamId, '/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    body: JSON.stringify({
      name: opts.projectName,
      project: opts.projectId,
      target: 'production',
      files: opts.files.map((f) => ({ file: f.path, data: f.content, encoding: f.encoding })),
      projectSettings: { framework: opts.framework },
      meta: { codelinkCommitSha: opts.commitSha, codelinkRepo: opts.repo },
    }),
  });
}

export const getDeployment = (token: string, teamId: string | null, id: string) =>
  vc<{ readyState: string; url: string; alias?: string[]; errorMessage?: string }>(token, teamId, `/v13/deployments/${id}`);

/** Last lines of the build log — enough for an AI to see what broke. */
export async function getBuildLogTail(token: string, teamId: string | null, id: string, lines = 60): Promise<string> {
  const events = await vc<any[]>(token, teamId, `/v3/deployments/${id}/events`);
  const text = (Array.isArray(events) ? events : [])
    .map((e) => e?.text ?? e?.payload?.text)
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
  return text.slice(-lines).join('\n');
}

export async function upsertEnv(token: string, teamId: string | null, projectId: string, key: string, value: string) {
  await vc(token, teamId, `/v10/projects/${projectId}/env?upsert=true`, {
    method: 'POST',
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
  });
}

/** Prefer the stable production alias (e.g. my-app.vercel.app) over the per-deploy URL. */
export function pickProductionAlias(aliases: string[] | undefined): string | null {
  if (!aliases?.length) return null;
  const vercelApp = aliases.filter((a) => a.endsWith('.vercel.app')).sort((a, b) => a.length - b.length);
  const custom = aliases.find((a) => !a.endsWith('.vercel.app'));
  const host = custom ?? vercelApp[0];
  return host ? `https://${host}` : null;
}
