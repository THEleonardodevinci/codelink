import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="CodeLink home">
      <svg className="logo-mark" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="1.5" y="7" width="14" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
        <rect x="10.5" y="7" width="14" height="12" rx="6" fill="none" stroke="var(--cobalt)" strokeWidth="3" />
      </svg>
      CodeLink
    </Link>
  );
}
