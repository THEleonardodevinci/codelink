import Link from 'next/link';
import { Logo } from './Logo';
import { currentUserId } from '@/lib/session';

export async function TopBar() {
  const signedIn = !!(await currentUserId());
  return (
    <header className="wrap bar">
      <Logo />
      <nav>
        <Link href="/docs">Docs</Link>
        {signedIn ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form action="/api/auth/logout" method="post">
              <button className="linkish" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <a className="btn small" href="/api/auth/github">Sign in with GitHub</a>
        )}
      </nav>
    </header>
  );
}
