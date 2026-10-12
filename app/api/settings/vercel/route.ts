import { currentUserId } from '@/lib/session';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { errorResponse, json, readJson, UserError } from '@/lib/http';
import { verifyVercel } from '@/lib/vercel';

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return json({ error: 'Sign in first' }, 401);
    const body = await readJson(req);
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const teamId = typeof body.teamId === 'string' && body.teamId.trim() ? body.teamId.trim() : null;
    if (!token) throw new UserError('Paste a Vercel access token');

    let username: string;
    try {
      username = await verifyVercel(token, teamId);
    } catch {
      throw new UserError(teamId ? 'Vercel rejected that token or team ID. Check both and try again.' : 'Vercel rejected that token. Create a new one and try again.');
    }
    await db()
      .from('users')
      .update({ vercel_token_enc: encrypt(token), vercel_team_id: teamId, vercel_username: username })
      .eq('id', userId);
    return json({ ok: true, username });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return json({ error: 'Sign in first' }, 401);
  await db().from('users').update({ vercel_token_enc: null, vercel_team_id: null, vercel_username: null }).eq('id', userId);
  return json({ ok: true });
}
