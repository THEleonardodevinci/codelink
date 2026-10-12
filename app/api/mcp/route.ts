import { userFromRequest } from '@/lib/auth';
import { UpstreamError, UserError } from '@/lib/http';
import { getStatus, listProjects, publish, setEnv } from '@/lib/publish';
import { UserRow } from '@/lib/db';

/**
 * CodeLink MCP server — stateless Streamable HTTP transport, JSON responses.
 * Auth: Authorization: Bearer clk_...  (or ?key=clk_... for clients without header support)
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS =
  'CodeLink publishes code to a GitHub repo and deploys it live on Vercel. ' +
  'When the user says "publish with CodeLink", call publish with the COMPLETE set of project files. ' +
  'Omit project_id for a new project; reuse the returned project_id for updates. ' +
  'After publishing, call get_status until status is READY (then share live_url) or ERROR (then fix the code and publish again). ' +
  'Never put secrets in files — use set_env.';

const TOOLS = [
  {
    name: 'publish',
    description:
      'Publish a project: commits the files to GitHub and deploys them to Vercel. Send every file in the project each time — files left out are deleted. Omit project_id to create a new project; pass it to update one. Returns a project_id.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'All project files. Use encoding "base64" for images and other binary files.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path, e.g. "index.html" or "src/App.jsx"' },
              content: { type: 'string' },
              encoding: { type: 'string', enum: ['utf-8', 'base64'] },
            },
            required: ['path', 'content'],
          },
        },
        project_id: { type: 'string', description: 'Existing project ID (cl_...) to update. Omit for a new project.' },
        name: { type: 'string', description: 'Short name for a new project, e.g. "pomodoro-timer". Ignored on updates.' },
        message: { type: 'string', description: 'Commit message describing the change.' },
        private: { type: 'boolean', description: 'Make the GitHub repo private (default true). New projects only.' },
      },
      required: ['files'],
    },
  },
  {
    name: 'get_status',
    description: 'Get build status, live URL, and build errors (if any) for a project.',
    inputSchema: { type: 'object', properties: { project_id: { type: 'string' } }, required: ['project_id'] },
  },
  {
    name: 'set_env',
    description: 'Set an environment variable (e.g. an API key) on a project. Takes effect on the next publish.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } },
      required: ['project_id', 'key', 'value'],
    },
  },
  {
    name: 'list_projects',
    description: "List the user's CodeLink projects with their IDs, status, and URLs.",
    inputSchema: { type: 'object', properties: {} },
  },
];

type RpcMessage = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: any };

const ok = (id: RpcMessage['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: RpcMessage['id'], code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function callTool(user: UserRow, name: string, args: any) {
  switch (name) {
    case 'publish':
      return publish(user, args ?? {});
    case 'get_status':
      return getStatus(user, args?.project_id);
    case 'set_env':
      return setEnv(user, args?.project_id, args?.key, args?.value);
    case 'list_projects':
      return { projects: await listProjects(user) };
    default:
      throw new UserError(`Unknown tool "${name}"`);
  }
}

async function handle(msg: RpcMessage, user: UserRow) {
  if (msg.id === undefined || msg.id === null) return null; // notification — no response
  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion;
      return ok(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'codelink', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      try {
        const result = await callTool(user, msg.params?.name, msg.params?.arguments);
        return ok(msg.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        // Tool failures go back to the model as readable errors so it can react.
        const text = e instanceof UserError || e instanceof UpstreamError ? e.message : 'Internal error';
        if (!(e instanceof UserError || e instanceof UpstreamError)) console.error(e);
        return ok(msg.id, { content: [{ type: 'text', text }], isError: true });
      }
    }
    default:
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) {
    return Response.json(fail(null, -32001, 'Missing or invalid CodeLink API key'), { status: 401 });
  }

  let body: RpcMessage | RpcMessage[];
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, 'Parse error'), { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map((m) => handle(m, user)))).filter(Boolean);
  if (!responses.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? responses : responses[0]);
}

// Stateless server: no server-initiated stream and no sessions to delete.
export const GET = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
export const DELETE = GET;
