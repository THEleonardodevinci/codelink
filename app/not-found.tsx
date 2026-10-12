import Link from 'next/link';
import { TopBar } from '@/components/TopBar';

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="narrow page-head">
        <h1 style={{ fontSize: '2.4rem' }}>Nothing here</h1>
        <p>That page or project doesn&apos;t exist on this account. <Link href="/dashboard">Go to the dashboard</Link>.</p>
      </main>
    </>
  );
}
