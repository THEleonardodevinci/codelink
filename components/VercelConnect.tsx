'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VercelConnect({ connectedAs }: { connectedAs: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!connectedAs);
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/settings/vercel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, teamId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || 'Could not connect Vercel');
    setToken('');
    setEditing(false);
    router.refresh();
  }

  async function disconnect() {
    await fetch('/api/settings/vercel', { method: 'DELETE' });
    setEditing(true);
    router.refresh();
  }

  if (!editing && connectedAs) {
    return (
      <div className="spread">
        <p>Connected as <strong>{connectedAs}</strong></p>
        <div className="row">
          <button className="linkish" onClick={() => setEditing(true)} type="button">Change token</button>
          <button className="linkish danger" onClick={disconnect} type="button">Disconnect</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="stack-sm">
      <label>
        Vercel access token
        <span className="hint">
          Create one at <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer">vercel.com/account/tokens</a> with full account scope.
        </span>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
      </label>
      <label>
        Team ID <span className="hint">Optional. Only if you deploy to a Vercel team instead of your personal account.</span>
        <input type="text" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team_..." />
      </label>
      {error && <p className="error-msg" role="alert">{error}</p>}
      <div className="row">
        <button className="btn small" disabled={busy || !token}>{busy ? 'Connecting…' : 'Connect Vercel'}</button>
        {connectedAs && <button className="linkish" type="button" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );
}
