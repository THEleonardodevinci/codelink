'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** While a build is in progress, re-render the server page every few seconds. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
