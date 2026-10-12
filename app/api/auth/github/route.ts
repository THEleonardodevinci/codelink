import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { appUrl, env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env('GITHUB_CLIENT_ID'));
  url.searchParams.set('redirect_uri', `${appUrl()}/api/auth/github/callback`);
  // repo: create repos and push commits on the user's behalf
  url.searchParams.set('scope', 'repo read:user');
  url.searchParams.set('state', state);

  const res = NextResponse.redirect(url);
  res.cookies.set('cl_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
