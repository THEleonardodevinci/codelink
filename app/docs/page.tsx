import { TopBar } from '@/components/TopBar';
import { CopyBlock } from '@/components/CopyBlock';
import { snippets } from '@/lib/snippets';
import { appUrl } from '@/lib/env';
import { LIMITS } from '@/lib/files';

export const metadata = { title: 'Docs · CodeLink' };

export default function Docs() {
  const s = snippets();
  const base = appUrl();
  return (
    <>
      <TopBar />
      <main className="narrow docs">
        <div className="page-head">
          <h1>Docs</h1>
          <p>How to connect an AI to CodeLink, and what it can do once it&apos;s connected.</p>
        </div>

        <h2>Before you start</h2>
        <p>
          Sign in with GitHub, connect Vercel, and create an API key on the <a href="/dashboard">dashboard</a>. Replace{' '}
          <code>YOUR_CODELINK_KEY</code> below with that key.
        </p>

        <h2>Connect your AI</h2>
        <h3>Claude Code</h3>
        <CopyBlock code={s.claudeCode} />
        <h3>Cursor</h3>
        <p>Add this to <code>~/.cursor/mcp.json</code>:</p>
        <CopyBlock code={s.cursor} />
        <h3>Claude Desktop and other MCP clients</h3>
        <p>For clients that only run local servers, bridge with <code>mcp-remote</code>:</p>
        <CopyBlock code={s.desktop} />
        <p>
          If a client only accepts a URL, use <code>{`${base}/api/mcp?key=YOUR_CODELINK_KEY`}</code>. Keys in URLs can end up in
          logs, so use a dedicated key you can revoke.
        </p>
        <h3>Any AI with a terminal</h3>
        <CopyBlock code={s.curl} />
        <h3>Teach your AI the workflow</h3>
        <p>Paste this into <code>CLAUDE.md</code>, <code>AGENTS.md</code>, or your custom instructions:</p>
        <CopyBlock code={s.agentNote} />

        <h2>MCP tools</h2>
        <h3>publish</h3>
        <p>
          Commits the files to GitHub and deploys to Vercel. Send every file each time: CodeLink publishes a full
          snapshot, so files you leave out are removed. Omit <code>project_id</code> to create a project. Arguments:{' '}
          <code>files</code> (array of <code>{'{ path, content, encoding? }'}</code>), <code>project_id</code>,{' '}
          <code>name</code>, <code>message</code>, <code>private</code> (default true).
        </p>
        <h3>get_status</h3>
        <p>Returns the build status (<code>QUEUED</code>, <code>BUILDING</code>, <code>READY</code>, <code>ERROR</code>), the live URL, and the tail of the build log when a build fails.</p>
        <h3>set_env</h3>
        <p>Stores an environment variable on the Vercel project, encrypted. It applies from the next publish.</p>
        <h3>list_projects</h3>
        <p>Lists every project on the account with its ID, status, and URLs.</p>

        <h2>REST API</h2>
        <p>Authenticate with <code>Authorization: Bearer YOUR_CODELINK_KEY</code>.</p>
        <ul>
          <li><code>POST /api/v1/publish</code> with the same body as the <code>publish</code> tool</li>
          <li><code>GET /api/v1/projects</code> lists projects</li>
          <li><code>GET /api/v1/projects/:id</code> returns status</li>
          <li><code>POST /api/v1/projects/:id/env</code> with <code>{'{ key, value }'}</code></li>
        </ul>

        <h2>Limits and rules</h2>
        <ul>
          <li>Up to {LIMITS.maxFiles} files and {LIMITS.maxBytes / 1e6} MB per publish.</li>
          <li><code>.env</code> files, <code>node_modules</code>, <code>.git</code>, <code>.next</code>, and <code>.vercel</code> are skipped and listed in the response.</li>
          <li>Frameworks are detected from <code>package.json</code>: Next.js, Vite, Astro, SvelteKit, Nuxt, Remix, Gatsby, and Create React App. Anything else deploys as a static site.</li>
          <li>Binary files (images, fonts) must be sent with <code>&quot;encoding&quot;: &quot;base64&quot;</code>.</li>
        </ul>
        <div style={{ height: 64 }} />
      </main>
    </>
  );
}
