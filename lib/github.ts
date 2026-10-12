import { UpstreamError } from './http';
import { CleanFile } from './files';
import { mapLimit, sleep } from './util';

const API = 'https://api.github.com';

async function gh<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CodeLink',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.message || msg;
      if (body.errors?.length) msg += ': ' + body.errors.map((e: any) => e.message || e.code).join(', ');
    } catch {}
    throw new UpstreamError('GitHub', res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const getViewer = (token: string) =>
  gh<{ id: number; login: string; avatar_url: string }>(token, '/user');

export async function exchangeCode(code: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    cache: 'no-store',
  });
  const body = await res.json();
  if (!body.access_token) throw new UpstreamError('GitHub', res.status, body.error_description || 'OAuth exchange failed');
  return body.access_token;
}

/** Returns null when the name is taken, so the caller can try another. */
export async function createRepo(token: string, name: string, isPrivate: boolean, description: string) {
  try {
    const r = await gh(token, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name, private: isPrivate, description, auto_init: true }),
    });
    return { fullName: r.full_name as string, defaultBranch: (r.default_branch as string) || 'main' };
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 422 && /already exists/i.test(e.message)) return null;
    throw e;
  }
}

/**
 * Commit the files as a complete snapshot: anything not in `files` is removed.
 * Text goes inline in the tree; binary files are uploaded as blobs first.
 */
export async function commitSnapshot(
  token: string,
  repo: string,
  branch: string,
  files: CleanFile[],
  message: string,
): Promise<string> {
  const refPath = `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`;
  let parent: string | undefined;
  // A freshly created repo can take a moment before its first ref is readable.
  for (let attempt = 0; ; attempt++) {
    try {
      const ref = await gh(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      parent = ref.object.sha;
      break;
    } catch (e) {
      if (e instanceof UpstreamError && (e.status === 404 || e.status === 409) && attempt < 5) {
        await sleep(1000);
        continue;
      }
      throw e;
    }
  }

  const tree = await mapLimit(files, 8, async (f) => {
    if (f.encoding === 'base64') {
      const blob = await gh(token, `/repos/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: f.content, encoding: 'base64' }),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }
    return { path: f.path, mode: '100644', type: 'blob', content: f.content };
  });

  const t = await gh(token, `/repos/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ tree }) });
  const c = await gh(token, `/repos/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: t.sha, parents: parent ? [parent] : [] }),
  });
  await gh(token, refPath, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: true }) });
  return c.sha as string;
}
