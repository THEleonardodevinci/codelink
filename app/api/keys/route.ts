import { currentUserId } from '@/lib/session';
import { db } from '@/lib/db';
import { newApiKey, sha256 } from '@/lib/crypto';
import { errorResponse, json, readJson } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return json({ error: 'Sign in first' }, 401);
    const body = await readJson(req);
    const name = (typeof body.name === 'string' && body.name.trim().slice(0, 60)) || 'My AI';
    const key = newApiKey();
    const { data, error } = await db()
      .from('api_keys')
      .insert({ user_id: userId, name, key_hash: sha256(key), key_prefix: key.slice(0, 10) })
      .select('id,name,key_prefix,created_at,last_used_at')
      .single();
    if (error) throw error;
    // The full key is returned exactly once and never stored.
    return json({ key, record: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return json({ error: 'Sign in first' }, 401);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);
  await db().from('api_keys').delete().eq('id', id).eq('user_id', userId);
  return json({ ok: true });
}
