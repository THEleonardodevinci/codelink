'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CopyBlock } from './CopyBlock';

type KeyRecord = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null };

export function KeyManager({ keys }: { keys: KeyRecord[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || 'Could not create key');
    setNewKey(body.key);
    setName('');
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key? Any AI using it will stop being able to publish.')) return;
    await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="stack-sm">
      {newKey && (
        <div className="stack-sm">
          <p className="ok-msg">Key created. Copy it now: it won&apos;t be shown again.</p>
          <CopyBlock code={newKey} />
        </div>
      )}
      {keys.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Key</th><th>Last used</th><th /></tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td className="mono">{k.key_prefix}…</td>
                  <td className="muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                  <td><button className="linkish danger" onClick={() => revoke(k.id)} type="button">Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={create} className="row" style={{ alignItems: 'end' }}>
        <label style={{ flex: '1 1 220px' }}>
          Key name <span className="hint">So you can tell keys apart, e.g. &ldquo;Claude Code laptop&rdquo;.</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My AI" />
        </label>
        <button className="btn small" disabled={busy}>{busy ? 'Creating…' : 'Create API key'}</button>
      </form>
      {error && <p className="error-msg" role="alert">{error}</p>}
    </div>
  );
}
