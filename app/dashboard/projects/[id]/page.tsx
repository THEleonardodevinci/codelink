import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { Status } from '@/components/Status';
import { CopyBlock } from '@/components/CopyBlock';
import { AutoRefresh } from '@/components/RefreshStatus';
import { requireSessionUser } from '@/lib/auth';
import { db, DeploymentRow } from '@/lib/db';
import { getStatus } from '@/lib/publish';
import { UserError } from '@/lib/http';
import { timeAgo } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const user = await requireSessionUser();

  let status: Awaited<ReturnType<typeof getStatus>>;
  let refreshError = '';
  try {
    status = await getStatus(user, params.id);
  } catch (e) {
    if (e instanceof UserError && e.status === 404) notFound();
    refreshError = e instanceof Error ? e.message : 'Could not refresh status';
    const { data } = await db().from('projects').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
    if (!data) notFound();
    status = {
      project_id: data.id, name: data.name, status: 'UNKNOWN', live_url: data.production_url, deployment_url: null,
      repo_url: `https://github.com/${data.github_repo}`, last_commit: null, last_published_at: null, error: undefined, hint: '',
    };
  }

  const { data } = await db()
    .from('deployments')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .limit(25);
  const deployments = (data ?? []) as DeploymentRow[];
  const building = !['READY', 'ERROR', 'CANCELED', 'NO_DEPLOYMENTS', 'UNKNOWN'].includes(status.status);

  return (
    <>
      <TopBar />
      <AutoRefresh active={building} />
      <main className="wrap stack" style={{ paddingBottom: 72 }}>
        <div className="page-head" style={{ paddingBottom: 0 }}>
          <p className="small"><Link href="/dashboard">Dashboard</Link> / {status.name}</p>
          <div className="spread" style={{ marginTop: 10 }}>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>{status.name}</h1>
            <Status value={status.status} />
          </div>
        </div>

        {refreshError && <p className="error-msg" role="alert">{refreshError}</p>}

        <section className="panel">
          <ul className="ticket-rows">
            <li><span className="k">Project ID</span><span className="v">{status.project_id}</span></li>
            <li><span className="k">Live URL</span><span className="v">{status.live_url ? <a href={status.live_url} target="_blank" rel="noreferrer">{status.live_url}</a> : 'Available after the first successful build'}</span></li>
            <li><span className="k">Repo</span><span className="v"><a href={status.repo_url} target="_blank" rel="noreferrer">{status.repo_url.replace('https://', '')}</a></span></li>
          </ul>
        </section>

        <section className="stack-sm">
          <h2 style={{ fontSize: '1.2rem' }}>Update this project from your AI</h2>
          <CopyBlock code={`Publish this with CodeLink to project ${status.project_id}`} />
        </section>

        {status.status === 'ERROR' && status.error && (
          <section className="stack-sm">
            <h2 style={{ fontSize: '1.2rem' }}>Build error</h2>
            <p className="muted">Your AI sees this too when it checks status. Ask it to fix the error and publish again.</p>
            <pre className="logbox"><code>{status.error}</code></pre>
          </section>
        )}

        <section className="stack-sm">
          <h2 style={{ fontSize: '1.2rem' }}>History</h2>
          {deployments.length === 0 ? (
            <p className="muted">Nothing published yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Status</th><th>Change</th><th>Commit</th><th>Files</th></tr></thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={d.id}>
                      <td className="muted">{timeAgo(d.created_at)}</td>
                      <td><Status value={d.status} /></td>
                      <td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.commit_message}</a> : d.commit_message}</td>
                      <td className="mono">{d.commit_sha ? <a href={`${status.repo_url}/commit/${d.commit_sha}`} target="_blank" rel="noreferrer">{d.commit_sha.slice(0, 7)}</a> : '—'}</td>
                      <td>{d.file_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
