import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { VercelConnect } from '@/components/VercelConnect';
import { KeyManager } from '@/components/KeyManager';
import { ConnectTabs } from '@/components/ConnectTabs';
import { ZipPublish } from '@/components/ZipPublish';
import { Status } from '@/components/Status';
import { requireSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { listProjects } from '@/lib/publish';
import { snippets } from '@/lib/snippets';
import { timeAgo } from '@/lib/util';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · CodeLink' };

export default async function Dashboard() {
  const user = await requireSessionUser();
  const [{ data: keys }, projects] = await Promise.all([
    db()
      .from('api_keys')
      .select('id,name,key_prefix,created_at,last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    listProjects(user),
  ]);

  const vercelReady = !!user.vercel_token_enc;
  const hasKey = (keys?.length ?? 0) > 0;
  const s = snippets();
  const tabs = [
    { id: 'cc', label: 'Claude Code', intro: 'Run this in your terminal, with your key in place of YOUR_CODELINK_KEY.', code: s.claudeCode },
    { id: 'cursor', label: 'Cursor', intro: 'Add this to ~/.cursor/mcp.json.', code: s.cursor },
    { id: 'desktop', label: 'Claude Desktop', intro: 'Add this to claude_desktop_config.json. It bridges to CodeLink with mcp-remote.', code: s.desktop },
    { id: 'any', label: 'Any AI', intro: 'Anything that can run a command can publish through the REST API.', code: s.curl },
    { id: 'rules', label: 'Instructions', intro: 'Paste into CLAUDE.md, AGENTS.md, or custom instructions so your AI knows the workflow.', code: s.agentNote },
  ];

  return (
    <>
      <TopBar />
      <main className="wrap stack" style={{ paddingBottom: 72 }}>
        <div className="page-head" style={{ paddingBottom: 0 }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>Hi, {user.github_login}</h1>
          <p>
            {vercelReady && hasKey
              ? 'You’re set up. Tell your AI to publish with CodeLink.'
              : 'Finish setup below, then tell your AI to publish with CodeLink.'}
          </p>
        </div>

        <div className="grid-2">
          <section className="panel stack-sm" aria-labelledby="setup-vercel">
            <div className="row"><span className="check done" aria-hidden="true">✓</span><h2 style={{ fontSize: '1.2rem' }}>GitHub</h2></div>
            <p className="muted">Signed in as {user.github_login}. New repos are created on this account.</p>
            <div className="row" style={{ marginTop: 12 }}>
              <span className={`check${vercelReady ? ' done' : ''}`} aria-hidden="true">{vercelReady ? '✓' : ''}</span>
              <h2 id="setup-vercel" style={{ fontSize: '1.2rem' }}>Vercel</h2>
            </div>
            <VercelConnect connectedAs={vercelReady ? user.vercel_username ?? 'Vercel user' : null} />
          </section>

          <section className="panel stack-sm" aria-labelledby="setup-keys">
            <div className="row">
              <span className={`check${hasKey ? ' done' : ''}`} aria-hidden="true">{hasKey ? '✓' : ''}</span>
              <h2 id="setup-keys" style={{ fontSize: '1.2rem' }}>API keys</h2>
            </div>
            <p className="muted">Each AI tool gets its own key. Keys can publish and update your projects.</p>
            <KeyManager keys={keys ?? []} />
          </section>
        </div>

        <section className="panel" aria-labelledby="connect">
          <h2 id="connect" style={{ fontSize: '1.2rem', marginBottom: 12 }}>Connect your AI</h2>
          <ConnectTabs tabs={tabs} />
        </section>

        <section aria-labelledby="projects" className="stack-sm">
          <h2 id="projects">Projects</h2>
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Ask your AI to publish something with CodeLink, or upload a zip below.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Project</th><th>ID</th><th>Status</th><th>Live URL</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.project_id}>
                      <td><Link href={`/dashboard/projects/${p.project_id}`}><strong>{p.name}</strong></Link></td>
                      <td className="mono">{p.project_id}</td>
                      <td><Status value={p.status} /></td>
                      <td className="mono">{p.live_url ? <a href={p.live_url} target="_blank" rel="noreferrer">{p.live_url.replace(/^https:\/\//, '')}</a> : '—'}</td>
                      <td className="muted">{timeAgo(p.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel stack-sm" aria-labelledby="upload">
          <h2 id="upload" style={{ fontSize: '1.2rem' }}>Publish a zip</h2>
          <p className="muted">For AIs that can&apos;t connect to CodeLink: download the project as a zip and drop it here.</p>
          <ZipPublish projects={projects} disabled={!vercelReady} />
        </section>
      </main>
    </>
  );
}
