import { TopBar } from '@/components/TopBar';
import { currentUserId } from '@/lib/session';

const SAMPLE_RESPONSE = `{
  "project_id": "cl_7xk2p9mf",
  "status": "READY",
  "live_url": "https://pomodoro-timer.vercel.app",
  "repo_url": "https://github.com/you/pomodoro-timer",
  "hint": "Live."
}`;

export default async function Home({ searchParams }: { searchParams: { error?: string } }) {
  const signedIn = !!(await currentUserId());
  return (
    <>
      <TopBar />
      <main>
        {searchParams.error === 'signin' && (
          <p className="wrap error-msg" role="alert">GitHub sign-in didn&apos;t finish. Try again.</p>
        )}

        <section className="wrap hero">
          <div>
            <h1>Tell your AI to ship it.</h1>
            <p className="lede">
              Say &ldquo;publish this with CodeLink&rdquo; and the code your AI wrote lands in a GitHub repo and goes
              live on Vercel. Your AI gets a project ID it can use to push every update after that.
            </p>
            <div className="hero-actions">
              <a className="btn" href={signedIn ? '/dashboard' : '/api/auth/github'}>
                {signedIn ? 'Open dashboard' : 'Sign in with GitHub'}
              </a>
              <a className="btn ghost" href="/docs">Read the docs</a>
            </div>
          </div>

          <div aria-label="Example: an AI publishing a project with CodeLink">
            <p className="chat-line reveal d1">publish this with CodeLink</p>
            <div className="ticket">
              <p className="ticket-caption reveal d2">Project ID</p>
              <p className="ticket-id reveal d2">cl_7xk2p9mf</p>
              <ul className="ticket-rows">
                <li className="reveal d3"><span className="k">Committed</span><span className="v">github.com/you/pomodoro-timer</span></li>
                <li className="reveal d4"><span className="k">Deployed</span><span className="v">pomodoro-timer.vercel.app</span></li>
                <li className="reveal d5"><span className="k">Status</span><span className="v"><span className="live-dot" />Live</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="wrap section">
          <h2>Three steps, once</h2>
          <ol className="steps">
            <li>
              <h3>Connect GitHub and Vercel</h3>
              <p>Sign in with GitHub and paste a Vercel token. Repos and deployments live in your own accounts.</p>
            </li>
            <li>
              <h3>Add CodeLink to your AI</h3>
              <p>One command for Claude Code, one config block for Cursor or Claude Desktop. Any AI with a terminal can use the API.</p>
            </li>
            <li>
              <h3>Say &ldquo;publish with CodeLink&rdquo;</h3>
              <p>Your AI sends the files, watches the build, and hands you the live link. If the build fails, it reads the error and fixes it.</p>
            </li>
          </ol>
        </section>

        <section className="wrap section split">
          <div>
            <h2>What your AI gets back</h2>
            <p>
              Every publish returns a project ID. Your AI reuses it to update the same site, so the URL never changes.
              Status checks return the build log when something breaks.
            </p>
          </div>
          <pre><code>{SAMPLE_RESPONSE}</code></pre>
        </section>

        <section className="wrap section split">
          <div>
            <h2>Built to be safe by default</h2>
          </div>
          <div className="stack-sm">
            <p className="muted">New repos are private unless your AI says otherwise.</p>
            <p className="muted"><code>.env</code> files are never committed. Secrets go in through <code>set_env</code> and are stored encrypted on Vercel.</p>
            <p className="muted">Your GitHub and Vercel tokens are encrypted at rest, and API keys are stored only as hashes. Revoke a key any time.</p>
          </div>
        </section>
      </main>
      <footer>
        <div className="wrap spread">
          <span>CodeLink</span>
          <a href="/docs">API and MCP reference</a>
        </div>
      </footer>
    </>
  );
}
