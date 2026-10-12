import { redirect } from 'next/navigation';
import { db, UserRow } from './db';
import { sha256 } from './crypto';
import { currentUserId } from './session';

export async function getUserById(id: string): Promise<UserRow | null> {
  const { data } = await db().from('users').select('*').eq('id', id).maybeSingle();
  return (data as UserRow) ?? null;
}

/**
 * Resolve the caller: an API key (Authorization: Bearer clk_..., or ?key= for
 * MCP clients that can't send headers), falling back to the dashboard session.
 */
export async function userFromRequest(req: Request): Promise<UserRow | null> {
  const header = req.headers.get('authorization');
  let key = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!key) key = new URL(req.url).searchParams.get('key') ?? undefined;

  if (key) {
    const { data } = await db().from('api_keys').select('id,user_id').eq('key_hash', sha256(key)).maybeSingle();
    if (!data) return null;
    void db().from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
    return getUserById(data.user_id);
  }

  const id = await currentUserId();
  return id ? getUserById(id) : null;
}

/** For pages: the signed-in user, or a redirect to the landing page. */
export async function requireSessionUser(): Promise<UserRow> {
  const id = await currentUserId();
  const user = id ? await getUserById(id) : null;
  if (!user) redirect('/');
  return user;
}
