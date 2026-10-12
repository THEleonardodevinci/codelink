import { NextRequest, NextResponse } from 'next/server';
import { appUrl, env } from '@/lib/env';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { exchangeCode, getViewer } from '@/lib/github';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expected = req.cookies.get('cl_oauth_state')?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${appUrl()}/?error=signin`);
  }

  try {
    const token = await exchangeCode(code, env('GITHUB_CLIENT_ID'), env('GITHUB_CLIENT_SECRET'));
    const viewer = await getViewer(token);
    const { data, error } = await db()
      .from('users')
      .upsert(
        {
          github_id: viewer.id,
          github_login: viewer.login,
          avatar_url: viewer.avatar_url,
          github_token_enc: encrypt(token),
        },
        { onConflict: 'github_id' },
      )
      .select('id')
      .single();
    if (error) throw error;

    const res = NextResponse.redirect(`${appUrl()}/dashboard`);
    res.cookies.set(SESSION_COOKIE, await signSession(data.id), sessionCookieOptions);
    res.cookies.delete('cl_oauth_state');
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${appUrl()}/?error=signin`);
  }
}
